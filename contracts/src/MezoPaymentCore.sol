// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MezoPaymentCore
 * @notice Core consumer payment engine for Mezo Network.
 * Handles:
 *  - Direct MUSD payments with human-readable notes.
 *  - Cryptographically authenticated merchant payment references (0-gas merchant QRs).
 *  - Timelocked safety limits (capped initial setup, 24h hike timelocks, independent timers, immediate decreases).
 *  - Deterministic open bill splitting with creator dust absorption.
 *  - Immediate payment announcement events for physical soundboxes and mobile notifications.
 *
 * Immutable, zero admin keys, zero owner backdoors, zero upgradeability proxies.
 */
contract MezoPaymentCore is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------
    // Constants
    // ---------------------------------------------------------

    /// @notice Timelock delay required before any limit hike takes effect.
    uint256 public constant TIMELOCK_DURATION = 1 days;

    /// @notice Maximum allowed initial per-transaction limit before timelock is required (50 MUSD).
    uint256 public constant MAX_INITIAL_PER_TX = 50 * 1e18;

    /// @notice Maximum allowed initial daily spending limit before timelock is required (200 MUSD).
    uint256 public constant MAX_INITIAL_DAILY = 200 * 1e18;

    // ---------------------------------------------------------
    // Structs
    // ---------------------------------------------------------

    struct SafetyLimit {
        uint256 dailyCap;            // Max MUSD allowed per 24-hour UTC calendar day
        uint256 perTxCap;            // Max MUSD allowed per single payment
        uint256 spentToday;          // Accumulated spend in current UTC day
        uint256 lastResetDay;        // block.timestamp / 1 days
        uint256 pendingDailyCap;     // Proposed new daily cap
        uint256 pendingPerTxCap;     // Proposed new per-tx cap
        uint256 pendingDailyTimelock; // Separate timelock expiry for daily cap (0 if none)
        uint256 pendingPerTxTimelock; // Separate timelock expiry for per-tx cap (0 if none)
        bool isConfigured;           // Payments revert until configured!
    }

    struct BillSplit {
        bytes32 splitId;             // Unique identifier for the split bill
        address creator;             // Creator who receives split payments
        uint256 totalAmount;         // Total bill including creator's portion
        uint256 collectedAmount;     // Sum collected from participants so far
        uint256 shareAmount;         // Fixed deterministic amount per participant
        uint16 participantCount;     // Payers EXCLUDING creator (1 to 50)
        uint16 paidCount;            // Number of participants who have paid
        bool isClosed;               // True when settled or cancelled
    }

    // ---------------------------------------------------------
    // Immutables & State Storage
    // ---------------------------------------------------------

    /// @notice Native MUSD token contract on Mezo Network.
    IERC20 public immutable musdToken;

    /// @notice Safety spending limits per user address.
    mapping(address => SafetyLimit) public safetyLimits;

    /// @notice Tracks paid merchant payment reference hashes to prevent double-spending or replay attacks.
    mapping(bytes32 => bool) public isReferencePaid;

    /// @notice Bill splits storage.
    mapping(bytes32 => BillSplit) public splits;

    /// @notice Nonce tracker for bill splits per creator.
    mapping(address => uint256) public splitNonce;

    /// @notice Tracks whether an address has already paid their share in a specific split.
    mapping(bytes32 => mapping(address => bool)) public splitHasPaid;

    // ---------------------------------------------------------
    // Events
    // ---------------------------------------------------------

    event LimitsUpdated(address indexed user, uint256 dailyCap, uint256 perTxCap);

    event LimitIncreaseQueued(
        address indexed user,
        uint256 pendingDailyCap,
        uint256 pendingPerTxCap,
        uint256 pendingDailyTimelock,
        uint256 pendingPerTxTimelock
    );

    event LimitIncreaseCancelled(address indexed user);

    event PaymentAnnounced(
        address indexed payer,
        address indexed payee,
        bytes32 indexed ref,
        uint256 amount,
        string note,
        uint256 timestamp
    );

    event SplitCreated(
        bytes32 indexed splitId,
        address indexed creator,
        uint256 totalAmount,
        uint256 shareAmount,
        uint16 participantCount,
        string description
    );

    event SplitSharePaid(
        bytes32 indexed splitId,
        address indexed payer,
        address indexed creator,
        uint256 shareAmount,
        uint16 paidCount,
        uint16 participantCount
    );

    event SplitCancelled(bytes32 indexed splitId);

    // ---------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------

    constructor(address _musdToken) {
        require(_musdToken != address(0), "Invalid MUSD token address");
        musdToken = IERC20(_musdToken);
    }

    // ---------------------------------------------------------
    // Safety Limits Configuration & Management
    // ---------------------------------------------------------

    /**
     * @notice Configures first-time spending safety limits for the caller.
     * @dev Enforces ceilings: perTxCap <= 50 MUSD and dailyCap <= 200 MUSD immediately.
     * Any excess requested above ceilings queues into the 24-hour timelock.
     */
    function setInitialSafetyLimits(uint256 requestedDailyCap, uint256 requestedPerTxCap) external {
        SafetyLimit storage limit = safetyLimits[msg.sender];
        require(!limit.isConfigured, "Safety limits already configured");
        require(requestedDailyCap > 0 && requestedPerTxCap > 0, "Limits must be greater than zero");
        require(requestedPerTxCap <= requestedDailyCap, "Per-tx cap exceeds daily cap");

        limit.isConfigured = true;
        limit.lastResetDay = block.timestamp / 1 days;

        // Per-tx cap capping
        if (requestedPerTxCap <= MAX_INITIAL_PER_TX) {
            limit.perTxCap = requestedPerTxCap;
        } else {
            limit.perTxCap = MAX_INITIAL_PER_TX;
            limit.pendingPerTxCap = requestedPerTxCap;
            limit.pendingPerTxTimelock = block.timestamp + TIMELOCK_DURATION;
        }

        // Daily cap capping
        if (requestedDailyCap <= MAX_INITIAL_DAILY) {
            limit.dailyCap = requestedDailyCap;
        } else {
            limit.dailyCap = MAX_INITIAL_DAILY;
            limit.pendingDailyCap = requestedDailyCap;
            limit.pendingDailyTimelock = block.timestamp + TIMELOCK_DURATION;
        }

        emit LimitsUpdated(msg.sender, limit.dailyCap, limit.perTxCap);

        if (limit.pendingDailyTimelock != 0 || limit.pendingPerTxTimelock != 0) {
            emit LimitIncreaseQueued(
                msg.sender,
                limit.pendingDailyCap,
                limit.pendingPerTxCap,
                limit.pendingDailyTimelock,
                limit.pendingPerTxTimelock
            );
        }
    }

    /**
     * @notice Modifies existing safety limits.
     * Decreases apply immediately and cancel any pending increases for that field.
     * Increases queue into independent 24-hour timelocks.
     */
    function updateSafetyLimits(uint256 newDailyCap, uint256 newPerTxCap) external {
        SafetyLimit storage limit = safetyLimits[msg.sender];
        require(limit.isConfigured, "Safety limits not configured");
        require(newDailyCap > 0 && newPerTxCap > 0, "Limits must be greater than zero");
        require(newPerTxCap <= newDailyCap, "Per-tx cap exceeds daily cap");

        bool updatedLimits = false;
        bool queuedIncrease = false;

        // Daily cap update logic
        if (newDailyCap < limit.dailyCap) {
            limit.dailyCap = newDailyCap;
            limit.pendingDailyCap = 0;
            limit.pendingDailyTimelock = 0;
            updatedLimits = true;
        } else if (newDailyCap > limit.dailyCap) {
            if (limit.pendingDailyCap != newDailyCap || limit.pendingDailyTimelock == 0) {
                limit.pendingDailyCap = newDailyCap;
                limit.pendingDailyTimelock = block.timestamp + TIMELOCK_DURATION;
                queuedIncrease = true;
            }
        } else {
            // Unchanged from current active limit: clear any pending increase for daily cap
            limit.pendingDailyCap = 0;
            limit.pendingDailyTimelock = 0;
        }

        // Per-tx cap update logic
        if (newPerTxCap < limit.perTxCap) {
            limit.perTxCap = newPerTxCap;
            limit.pendingPerTxCap = 0;
            limit.pendingPerTxTimelock = 0;
            updatedLimits = true;
        } else if (newPerTxCap > limit.perTxCap) {
            if (limit.pendingPerTxCap != newPerTxCap || limit.pendingPerTxTimelock == 0) {
                limit.pendingPerTxCap = newPerTxCap;
                limit.pendingPerTxTimelock = block.timestamp + TIMELOCK_DURATION;
                queuedIncrease = true;
            }
        } else {
            // Unchanged from current active limit: clear any pending increase for per-tx cap
            limit.pendingPerTxCap = 0;
            limit.pendingPerTxTimelock = 0;
        }

        if (updatedLimits) {
            emit LimitsUpdated(msg.sender, limit.dailyCap, limit.perTxCap);
        }

        if (queuedIncrease) {
            emit LimitIncreaseQueued(
                msg.sender,
                limit.pendingDailyCap,
                limit.pendingPerTxCap,
                limit.pendingDailyTimelock,
                limit.pendingPerTxTimelock
            );
        }
    }

    /**
     * @notice Executes pending limit increases whose 24-hour timelock delay has elapsed.
     * Handles independent timers: applies any ready cap without waiting for or resetting unready ones.
     */
    function executePendingLimitIncrease() external {
        SafetyLimit storage limit = safetyLimits[msg.sender];
        require(limit.isConfigured, "Safety limits not configured");

        bool executed = false;

        if (limit.pendingDailyTimelock != 0 && block.timestamp >= limit.pendingDailyTimelock) {
            limit.dailyCap = limit.pendingDailyCap;
            limit.pendingDailyCap = 0;
            limit.pendingDailyTimelock = 0;
            executed = true;
        }

        if (limit.pendingPerTxTimelock != 0 && block.timestamp >= limit.pendingPerTxTimelock) {
            limit.perTxCap = limit.pendingPerTxCap;
            limit.pendingPerTxCap = 0;
            limit.pendingPerTxTimelock = 0;
            executed = true;
        }

        require(executed, "No pending limit increase ready to execute");
        emit LimitsUpdated(msg.sender, limit.dailyCap, limit.perTxCap);
    }

    /**
     * @notice Cancels all active pending limit increases for the caller.
     */
    function cancelPendingLimitIncrease() external {
        SafetyLimit storage limit = safetyLimits[msg.sender];
        require(limit.isConfigured, "Safety limits not configured");
        require(limit.pendingDailyTimelock != 0 || limit.pendingPerTxTimelock != 0, "No pending limit increase");

        limit.pendingDailyCap = 0;
        limit.pendingDailyTimelock = 0;
        limit.pendingPerTxCap = 0;
        limit.pendingPerTxTimelock = 0;

        emit LimitIncreaseCancelled(msg.sender);
    }

    // ---------------------------------------------------------
    // Core Payment Methods
    // ---------------------------------------------------------

    /**
     * @notice Direct peer-to-peer or static merchant MUSD payment with an attached note.
     * @param to Recipient address.
     * @param amount MUSD amount (18 decimals).
     * @param note Human-readable payment description (max 140 chars).
     */
    function payDirect(address to, uint256 amount, string calldata note) external nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(msg.sender != to, "Cannot pay oneself");
        require(amount > 0, "Payment amount must be greater than zero");
        require(bytes(note).length <= 140, "Note exceeds 140 characters");
        require(musdToken.allowance(msg.sender, address(this)) >= amount, "Insufficient MUSD allowance");

        _enforceLimits(msg.sender, amount);

        bytes32 ref = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, to, amount, block.timestamp));
        musdToken.safeTransferFrom(msg.sender, to, amount);

        emit PaymentAnnounced(msg.sender, to, ref, amount, note, block.timestamp);
    }

    /**
     * @notice Cryptographically authenticated dynamic merchant reference payment.
     * @dev Zero merchant gas: merchant creates intent locally, signs with EIP-191, renders QR.
     * Contract reconstructs reference hash from parameters, validates merchant's signature, and checks expiry.
     * @param merchant The merchant address receiving payment.
     * @param amount The exact payment amount required by the invoice.
     * @param expiry Unix timestamp deadline.
     * @param salt Unique merchant-generated random salt.
     * @param note Invoice note or order ID.
     * @param merchantSignature Cryptographic signature of the reference hash by merchant.
     */
    function payReference(
        address merchant,
        uint256 amount,
        uint64 expiry,
        bytes32 salt,
        string calldata note,
        bytes calldata merchantSignature
    ) external nonReentrant {
        require(merchant != address(0), "Invalid merchant");
        require(msg.sender != merchant, "Cannot pay oneself");
        require(amount > 0, "Payment amount must be greater than zero");
        require(block.timestamp <= expiry, "Reference expired");
        require(bytes(note).length <= 140, "Note exceeds 140 characters");

        // Compute domain-bound payment reference hash
        bytes32 ref = keccak256(abi.encodePacked(block.chainid, address(this), merchant, amount, expiry, salt));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", ref));

        address signer = ECDSA.recover(ethSignedHash, merchantSignature);
        require(signer == merchant, "Invalid merchant signature");

        require(!isReferencePaid[ref], "Reference already paid");
        isReferencePaid[ref] = true;

        require(musdToken.allowance(msg.sender, address(this)) >= amount, "Insufficient MUSD allowance");

        _enforceLimits(msg.sender, amount);
        musdToken.safeTransferFrom(msg.sender, merchant, amount);

        emit PaymentAnnounced(msg.sender, merchant, ref, amount, note, block.timestamp);
    }

    // ---------------------------------------------------------
    // Open Bill Splits
    // ---------------------------------------------------------

    /**
     * @notice Creates an open bill split where participants pay fixed shares directly to creator.
     * @param totalAmount Total bill amount including creator's portion.
     * @param participantCount Number of participants EXCLUDING creator (1 to 50).
     * @param description Brief memo or receipt tag.
     */
    function createSplit(
        uint256 totalAmount,
        uint16 participantCount,
        string calldata description
    ) external returns (bytes32 splitId) {
        require(participantCount >= 1 && participantCount <= 50, "Participant count out of bounds (1-50)");
        require(totalAmount > 0, "Total amount must be greater than zero");
        require(bytes(description).length <= 140, "Description exceeds 140 characters");

        // Creator absorbs rounding dust: share is exact floor division
        uint256 shareAmount = totalAmount / (participantCount + 1);
        require(shareAmount > 0, "Share amount rounds to zero");

        splitNonce[msg.sender]++;
        splitId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, splitNonce[msg.sender]));

        splits[splitId] = BillSplit({
            splitId: splitId,
            creator: msg.sender,
            totalAmount: totalAmount,
            collectedAmount: 0,
            shareAmount: shareAmount,
            participantCount: participantCount,
            paidCount: 0,
            isClosed: false
        });

        emit SplitCreated(splitId, msg.sender, totalAmount, shareAmount, participantCount, description);
    }

    /**
     * @notice Pays a participant's deterministic share for an open bill split.
     * @param splitId The unique ID of the bill split.
     */
    function paySplitShare(bytes32 splitId) external nonReentrant {
        BillSplit storage split = splits[splitId];
        require(split.creator != address(0), "Split does not exist");
        require(!split.isClosed, "Split is closed");
        require(msg.sender != split.creator, "Creator cannot pay own split");
        require(!splitHasPaid[splitId][msg.sender], "Already paid this split");
        require(split.paidCount < split.participantCount, "Split already fully settled");

        uint256 share = split.shareAmount;
        require(share > 0, "Payment amount must be greater than zero");
        require(musdToken.allowance(msg.sender, address(this)) >= share, "Insufficient MUSD allowance");

        _enforceLimits(msg.sender, share);

        splitHasPaid[splitId][msg.sender] = true;
        split.paidCount++;
        split.collectedAmount += share;

        if (split.paidCount == split.participantCount) {
            split.isClosed = true;
        }

        musdToken.safeTransferFrom(msg.sender, split.creator, share);

        emit SplitSharePaid(splitId, msg.sender, split.creator, share, split.paidCount, split.participantCount);
        emit PaymentAnnounced(msg.sender, split.creator, splitId, share, "Split share payment", block.timestamp);
    }

    /**
     * @notice Cancels an open bill split. Only callable by the split creator.
     */
    function cancelSplit(bytes32 splitId) external {
        BillSplit storage split = splits[splitId];
        require(split.creator == msg.sender, "Only creator can cancel split");
        require(!split.isClosed, "Split already closed");

        split.isClosed = true;
        emit SplitCancelled(splitId);
    }

    // ---------------------------------------------------------
    // View Helpers
    // ---------------------------------------------------------

    /**
     * @notice Returns remaining spendable MUSD for a user in the current UTC day.
     * Accurately accounts for midnight UTC calendar day rollover.
     */
    function getEffectiveRemainingDailySpend(address user) external view returns (uint256) {
        SafetyLimit memory limit = safetyLimits[user];
        if (!limit.isConfigured) return 0;

        uint256 currentDay = block.timestamp / 1 days;
        uint256 spent = (currentDay > limit.lastResetDay) ? 0 : limit.spentToday;

        if (spent >= limit.dailyCap) {
            return 0;
        }
        return limit.dailyCap - spent;
    }

    /**
     * @notice Returns pending limit increases and active timelock deadlines.
     */
    function getPendingLimits(address user) external view returns (
        uint256 pendingDailyCap,
        uint256 pendingPerTxCap,
        uint256 pendingDailyTimelock,
        uint256 pendingPerTxTimelock
    ) {
        SafetyLimit memory limit = safetyLimits[user];
        return (
            limit.pendingDailyCap,
            limit.pendingPerTxCap,
            limit.pendingDailyTimelock,
            limit.pendingPerTxTimelock
        );
    }

    /**
     * @notice Returns the full safety limit state struct for a user.
     */
    function getSafetyLimits(address user) external view returns (SafetyLimit memory) {
        return safetyLimits[user];
    }

    /**
     * @notice Returns bill split details.
     */
    function getSplit(bytes32 splitId) external view returns (BillSplit memory) {
        return splits[splitId];
    }

    /**
     * @notice Helper to compute reference hash for off-chain merchant signature generation.
     */
    function computeReferenceHash(
        address merchant,
        uint256 amount,
        uint64 expiry,
        bytes32 salt
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(block.chainid, address(this), merchant, amount, expiry, salt));
    }

    // ---------------------------------------------------------
    // Internal Limit Enforcement
    // ---------------------------------------------------------

    function _enforceLimits(address user, uint256 amount) internal {
        SafetyLimit storage limit = safetyLimits[user];
        require(limit.isConfigured, "Safety limits not configured");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= limit.perTxCap, "Amount exceeds per-tx cap");

        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > limit.lastResetDay) {
            limit.spentToday = 0;
            limit.lastResetDay = currentDay;
        }

        require(limit.spentToday + amount <= limit.dailyCap, "Amount exceeds daily cap");
        limit.spentToday += amount;
    }
}
