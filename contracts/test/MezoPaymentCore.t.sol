// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/MezoPaymentCore.sol";
import "./mocks/MockERC20.sol";

contract MezoPaymentCoreTest is Test {
    MezoPaymentCore public core;
    MockERC20 public musd;

    uint256 internal merchantPk = 0xBEEF;
    address public merchant;

    uint256 internal attackerPk = 0xDEAD;
    address public attacker;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xCC);

    event PaymentAnnounced(
        address indexed payer,
        address indexed payee,
        bytes32 indexed ref,
        uint256 amount,
        string note,
        uint256 timestamp
    );

    event LimitsUpdated(address indexed user, uint256 dailyCap, uint256 perTxCap);
    event LimitIncreaseQueued(
        address indexed user,
        uint256 pendingDailyCap,
        uint256 pendingPerTxCap,
        uint256 pendingDailyTimelock,
        uint256 pendingPerTxTimelock
    );
    event LimitIncreaseCancelled(address indexed user);

    function setUp() public {
        merchant = vm.addr(merchantPk);
        attacker = vm.addr(attackerPk);

        musd = new MockERC20("Mezo USD", "MUSD");
        core = new MezoPaymentCore(address(musd));

        // Fund accounts
        musd.mint(alice, 10_000 * 1e18);
        musd.mint(bob, 10_000 * 1e18);
        musd.mint(charlie, 10_000 * 1e18);

        // Max approve MezoPaymentCore
        vm.prank(alice);
        musd.approve(address(core), type(uint256).max);

        vm.prank(bob);
        musd.approve(address(core), type(uint256).max);

        vm.prank(charlie);
        musd.approve(address(core), type(uint256).max);
    }

    // =========================================================
    // 1. Initial Limits Setup & Capping
    // =========================================================

    function test_InitialLimits_WithinCeilings() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit LimitsUpdated(alice, 100 * 1e18, 25 * 1e18);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        MezoPaymentCore.SafetyLimit memory limits = core.getSafetyLimits(alice);
        assertTrue(limits.isConfigured);
        assertEq(limits.dailyCap, 100 * 1e18);
        assertEq(limits.perTxCap, 25 * 1e18);
        assertEq(limits.pendingDailyCap, 0);
        assertEq(limits.pendingPerTxCap, 0);
        assertEq(core.getEffectiveRemainingDailySpend(alice), 100 * 1e18);
    }

    function test_InitialLimits_AboveCeilings_QueuesExcess() public {
        vm.prank(alice);
        // Request 500 daily, 100 per-tx (ceilings are 200 daily, 50 per-tx)
        core.setInitialSafetyLimits(500 * 1e18, 100 * 1e18);

        MezoPaymentCore.SafetyLimit memory limits = core.getSafetyLimits(alice);
        assertTrue(limits.isConfigured);
        assertEq(limits.dailyCap, 200 * 1e18); // capped to max initial
        assertEq(limits.perTxCap, 50 * 1e18);  // capped to max initial
        assertEq(limits.pendingDailyCap, 500 * 1e18);
        assertEq(limits.pendingPerTxCap, 100 * 1e18);
        assertEq(limits.pendingDailyTimelock, block.timestamp + 1 days);
        assertEq(limits.pendingPerTxTimelock, block.timestamp + 1 days);
    }

    function test_RevertWhen_SettingInitialLimitsTwice() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Safety limits already configured");
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);
    }

    function test_RevertWhen_PerTxExceedsDailyCap() public {
        vm.prank(alice);
        vm.expectRevert("Per-tx cap exceeds daily cap");
        core.setInitialSafetyLimits(50 * 1e18, 60 * 1e18);
    }

    function test_RevertWhen_InitialLimitsZero() public {
        vm.prank(alice);
        vm.expectRevert("Limits must be greater than zero");
        core.setInitialSafetyLimits(0, 0);
    }

    // =========================================================
    // 2. Limit Updates, Decreases, Increases & Timelocks
    // =========================================================

    function test_UpdateLimits_ImmediateDecrease_ClearsPending() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(500 * 1e18, 100 * 1e18); // queues pending

        // Lower daily cap to 150 (< 200) and perTx to 30 (< 50)
        vm.prank(alice);
        core.updateSafetyLimits(150 * 1e18, 30 * 1e18);

        MezoPaymentCore.SafetyLimit memory limits = core.getSafetyLimits(alice);
        assertEq(limits.dailyCap, 150 * 1e18);
        assertEq(limits.perTxCap, 30 * 1e18);
        assertEq(limits.pendingDailyCap, 0);
        assertEq(limits.pendingDailyTimelock, 0);
        assertEq(limits.pendingPerTxCap, 0);
        assertEq(limits.pendingPerTxTimelock, 0);
    }

    function test_UpdateLimits_IndependentTimelocks() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        // Queue daily hike to 150 at t=0
        vm.prank(alice);
        core.updateSafetyLimits(150 * 1e18, 25 * 1e18);

        uint256 dailyDeadline = block.timestamp + 1 days;
        (uint256 pDaily, uint256 pPerTx, uint256 tDaily, uint256 tPerTx) = core.getPendingLimits(alice);
        assertEq(pDaily, 150 * 1e18);
        assertEq(tDaily, dailyDeadline);
        assertEq(pPerTx, 0);
        assertEq(tPerTx, 0);

        // Advance 12 hours
        vm.warp(block.timestamp + 12 hours);

        // Queue per-tx hike to 40 at t=12 hours
        vm.prank(alice);
        core.updateSafetyLimits(150 * 1e18, 40 * 1e18);

        (, pPerTx, tDaily, tPerTx) = core.getPendingLimits(alice);
        assertEq(tDaily, dailyDeadline); // Daily deadline NOT reset!
        assertEq(pPerTx, 40 * 1e18);
        assertEq(tPerTx, block.timestamp + 1 days); // Per-tx deadline is 12h later

        // Advance 12 hours more (t=24 hours): daily should be ready, per-tx not ready yet
        vm.warp(dailyDeadline);
        vm.prank(alice);
        core.executePendingLimitIncrease();

        MezoPaymentCore.SafetyLimit memory limits = core.getSafetyLimits(alice);
        assertEq(limits.dailyCap, 150 * 1e18);
        assertEq(limits.perTxCap, 25 * 1e18); // unchanged yet

        // Advance another 12 hours (t=36 hours): per-tx can now be executed
        vm.warp(block.timestamp + 12 hours);
        vm.prank(alice);
        core.executePendingLimitIncrease();

        limits = core.getSafetyLimits(alice);
        assertEq(limits.perTxCap, 40 * 1e18);
    }

    function test_CancelPendingLimitIncrease() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(500 * 1e18, 100 * 1e18);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit LimitIncreaseCancelled(alice);
        core.cancelPendingLimitIncrease();

        MezoPaymentCore.SafetyLimit memory limits = core.getSafetyLimits(alice);
        assertEq(limits.pendingDailyCap, 0);
        assertEq(limits.pendingDailyTimelock, 0);
        assertEq(limits.pendingPerTxCap, 0);
        assertEq(limits.pendingPerTxTimelock, 0);
    }

    // =========================================================
    // 3. Direct Payments (`payDirect`)
    // =========================================================

    function test_PayDirect_Success() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 amount = 15 * 1e18;
        string memory note = "Chai and snacks";

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PaymentAnnounced(alice, bob, bytes32(0), amount, note, block.timestamp);
        core.payDirect(bob, amount, note);

        assertEq(musd.balanceOf(bob), 10_000 * 1e18 + amount);
        assertEq(core.getEffectiveRemainingDailySpend(alice), 85 * 1e18);
    }

    function test_RevertWhen_PayDirect_Unconfigured() public {
        vm.prank(alice);
        vm.expectRevert("Safety limits not configured");
        core.payDirect(bob, 10 * 1e18, "Coffee");
    }

    function test_RevertWhen_PayDirect_SelfPayment() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Cannot pay oneself");
        core.payDirect(alice, 10 * 1e18, "Coffee");
    }

    function test_RevertWhen_PayDirect_ZeroAddress() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Invalid recipient");
        core.payDirect(address(0), 10 * 1e18, "Coffee");
    }

    function test_RevertWhen_PayDirect_ZeroAmount() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Payment amount must be greater than zero");
        core.payDirect(bob, 0, "Zero amount");
    }

    function test_RevertWhen_PayDirect_ExceedsPerTxCap() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Amount exceeds per-tx cap");
        core.payDirect(bob, 30 * 1e18, "Coffee");
    }

    function test_RevertWhen_PayDirect_ExceedsDailyCap() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(50 * 1e18, 25 * 1e18);

        vm.startPrank(alice);
        core.payDirect(bob, 25 * 1e18, "P1");
        core.payDirect(bob, 25 * 1e18, "P2");

        // 3rd payment exceeds 50 daily cap
        vm.expectRevert("Amount exceeds daily cap");
        core.payDirect(bob, 1 * 1e18, "P3");
        vm.stopPrank();
    }

    function test_PayDirect_DailyCapResetsAfterMidnightUTC() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(50 * 1e18, 25 * 1e18);

        vm.startPrank(alice);
        core.payDirect(bob, 25 * 1e18, "Day 1 - P1");
        core.payDirect(bob, 25 * 1e18, "Day 1 - P2");
        assertEq(core.getEffectiveRemainingDailySpend(alice), 0);

        // Warp past midnight UTC (advance 1 full day)
        vm.warp(block.timestamp + 1 days + 1);

        assertEq(core.getEffectiveRemainingDailySpend(alice), 50 * 1e18);
        core.payDirect(bob, 25 * 1e18, "Day 2 - P1");
        assertEq(core.getEffectiveRemainingDailySpend(alice), 25 * 1e18);
        vm.stopPrank();
    }

    function test_RevertWhen_PayDirect_NoteTooLong() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        string memory longNote = new string(141);
        vm.prank(alice);
        vm.expectRevert("Note exceeds 140 characters");
        core.payDirect(bob, 10 * 1e18, longNote);
    }

    function test_RevertWhen_PayDirect_InsufficientAllowance() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        // Reduce allowance to 5
        vm.prank(alice);
        musd.approve(address(core), 5 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Insufficient MUSD allowance");
        core.payDirect(bob, 10 * 1e18, "Coffee");
    }

    // =========================================================
    // 4. Merchant-Signed Reference Payments (`payReference`)
    // =========================================================

    function _signMerchantReference(
        uint256 pk,
        address _merchant,
        uint256 amount,
        uint64 expiry,
        bytes32 salt
    ) internal view returns (bytes memory) {
        bytes32 ref = core.computeReferenceHash(_merchant, amount, expiry, salt);
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", ref));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function test_PayReference_Success() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 amount = 15 * 1e18;
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 salt = keccak256("order_42");
        bytes memory sig = _signMerchantReference(merchantPk, merchant, amount, expiry, salt);

        bytes32 ref = core.computeReferenceHash(merchant, amount, expiry, salt);
        vm.expectEmit(true, true, true, true);
        emit PaymentAnnounced(alice, merchant, ref, amount, "Order #42", block.timestamp);

        vm.prank(alice);
        core.payReference(merchant, amount, expiry, salt, "Order #42", sig);

        assertTrue(core.isReferencePaid(ref));
        assertEq(musd.balanceOf(merchant), amount);
    }

    function test_RevertWhen_PayReference_ZeroAmount() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 salt = keccak256("order_zero");
        bytes memory sig = _signMerchantReference(merchantPk, merchant, 0, expiry, salt);

        vm.prank(alice);
        vm.expectRevert("Payment amount must be greater than zero");
        core.payReference(merchant, 0, expiry, salt, "Zero MUSD", sig);
    }

    function test_RevertWhen_PayReference_TamperedAmount() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 genuineAmount = 15 * 1e18;
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 salt = keccak256("order_42");
        bytes memory sig = _signMerchantReference(merchantPk, merchant, genuineAmount, expiry, salt);

        // Attacker attempts to pay only 5 MUSD using genuine signature
        vm.prank(alice);
        vm.expectRevert("Invalid merchant signature");
        core.payReference(merchant, 5 * 1e18, expiry, salt, "Order #42", sig);
    }

    function test_RevertWhen_PayReference_TamperedMerchant() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 amount = 15 * 1e18;
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 salt = keccak256("order_42");
        bytes memory sig = _signMerchantReference(merchantPk, merchant, amount, expiry, salt);

        // Attacker attempts to redirect payment to attacker address
        vm.prank(alice);
        vm.expectRevert("Invalid merchant signature");
        core.payReference(attacker, amount, expiry, salt, "Order #42", sig);
    }

    function test_RevertWhen_PayReference_Expired() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 amount = 15 * 1e18;
        uint64 expiry = uint64(block.timestamp + 10 minutes);
        bytes32 salt = keccak256("order_expired");
        bytes memory sig = _signMerchantReference(merchantPk, merchant, amount, expiry, salt);

        // Warp past expiry
        vm.warp(block.timestamp + 11 minutes);

        vm.prank(alice);
        vm.expectRevert("Reference expired");
        core.payReference(merchant, amount, expiry, salt, "Order Expired", sig);
    }

    function test_RevertWhen_PayReference_ReplayAttack() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 amount = 15 * 1e18;
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 salt = keccak256("order_replay");
        bytes memory sig = _signMerchantReference(merchantPk, merchant, amount, expiry, salt);

        vm.prank(alice);
        core.payReference(merchant, amount, expiry, salt, "Order 1st pay", sig);

        // Replay attempt
        vm.prank(alice);
        vm.expectRevert("Reference already paid");
        core.payReference(merchant, amount, expiry, salt, "Order 2nd pay replay", sig);
    }

    function test_RevertWhen_PayReference_SignedByAttacker() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 25 * 1e18);

        uint256 amount = 15 * 1e18;
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 salt = keccak256("order_forged");
        // Forged signature signed by attacker instead of merchant
        bytes memory forgedSig = _signMerchantReference(attackerPk, merchant, amount, expiry, salt);

        vm.prank(alice);
        vm.expectRevert("Invalid merchant signature");
        core.payReference(merchant, amount, expiry, salt, "Order Forged", forgedSig);
    }

    // =========================================================
    // 5. Open Bill Splits (`createSplit`, `paySplitShare`, `cancelSplit`)
    // =========================================================

    function test_Split_Success_And_DustAbsorption() public {
        // Alice creates a split for 100 MUSD with 2 participants (total 3 people: Alice, Bob, Charlie)
        // Share = 100 / 3 = 33.333333333333333333 MUSD each.
        // Alice absorbs remaining dust: 100 - (2 * 33.333333333333333333) = 33.333333333333333334 MUSD.
        uint256 total = 100 * 1e18;
        uint256 expectedShare = total / 3;

        vm.prank(alice);
        bytes32 splitId = core.createSplit(total, 2, "Dinner party");

        MezoPaymentCore.BillSplit memory split = core.getSplit(splitId);
        assertEq(split.creator, alice);
        assertEq(split.totalAmount, total);
        assertEq(split.shareAmount, expectedShare);
        assertEq(split.participantCount, 2);
        assertEq(split.paidCount, 0);
        assertFalse(split.isClosed);

        // Configure limits for Bob & Charlie
        vm.prank(bob);
        core.setInitialSafetyLimits(100 * 1e18, 50 * 1e18);
        vm.prank(charlie);
        core.setInitialSafetyLimits(100 * 1e18, 50 * 1e18);

        uint256 aliceInitialBal = musd.balanceOf(alice);

        // Bob pays his share
        vm.prank(bob);
        core.paySplitShare(splitId);
        assertTrue(core.splitHasPaid(splitId, bob));
        assertEq(musd.balanceOf(alice), aliceInitialBal + expectedShare);

        split = core.getSplit(splitId);
        assertEq(split.paidCount, 1);
        assertFalse(split.isClosed);

        // Charlie pays his share
        vm.prank(charlie);
        core.paySplitShare(splitId);
        assertTrue(core.splitHasPaid(splitId, charlie));
        assertEq(musd.balanceOf(alice), aliceInitialBal + (expectedShare * 2));

        split = core.getSplit(splitId);
        assertEq(split.paidCount, 2);
        assertTrue(split.isClosed); // Automatically closed when fully paid!
    }

    function test_RevertWhen_Split_CreatorPaysOwnSplit() public {
        vm.prank(alice);
        core.setInitialSafetyLimits(100 * 1e18, 50 * 1e18);

        vm.prank(alice);
        bytes32 splitId = core.createSplit(60 * 1e18, 2, "Lunch");

        vm.prank(alice);
        vm.expectRevert("Creator cannot pay own split");
        core.paySplitShare(splitId);
    }

    function test_RevertWhen_Split_ParticipantPaysTwice() public {
        vm.prank(alice);
        bytes32 splitId = core.createSplit(60 * 1e18, 2, "Lunch");

        vm.prank(bob);
        core.setInitialSafetyLimits(100 * 1e18, 50 * 1e18);

        vm.prank(bob);
        core.paySplitShare(splitId);

        vm.prank(bob);
        vm.expectRevert("Already paid this split");
        core.paySplitShare(splitId);
    }

    function test_RevertWhen_Split_ParticipantCountZeroOrTooLarge() public {
        vm.prank(alice);
        vm.expectRevert("Participant count out of bounds (1-50)");
        core.createSplit(100 * 1e18, 0, "Zero participants");

        vm.prank(alice);
        vm.expectRevert("Participant count out of bounds (1-50)");
        core.createSplit(100 * 1e18, 51, "Too many participants");
    }

    function test_RevertWhen_Split_ShareRoundsToZero() public {
        // totalAmount = 1 wei, participantCount = 2 -> 1 / 3 = 0 wei
        vm.prank(alice);
        vm.expectRevert("Share amount rounds to zero");
        core.createSplit(1, 2, "Tiny split");
    }

    function test_CancelSplit_Success() public {
        vm.prank(alice);
        bytes32 splitId = core.createSplit(60 * 1e18, 2, "Trip");

        vm.prank(alice);
        core.cancelSplit(splitId);

        MezoPaymentCore.BillSplit memory split = core.getSplit(splitId);
        assertTrue(split.isClosed);

        vm.prank(bob);
        core.setInitialSafetyLimits(100 * 1e18, 50 * 1e18);

        vm.prank(bob);
        vm.expectRevert("Split is closed");
        core.paySplitShare(splitId);
    }

    function test_RevertWhen_NonCreatorCancelsSplit() public {
        vm.prank(alice);
        bytes32 splitId = core.createSplit(60 * 1e18, 2, "Trip");

        vm.prank(bob);
        vm.expectRevert("Only creator can cancel split");
        core.cancelSplit(splitId);
    }
}
