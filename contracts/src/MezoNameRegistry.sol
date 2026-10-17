// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MezoNameRegistry
 * @notice Immutable, zero-admin, zero-upgrade handle registry for MezoPay.
 * Maps human-readable handles (e.g. "alice" displayed with the Mezo suffix in frontend) to Mezo addresses.
 * Enforces alphanumeric character constraints, length bounds (3-20 chars), and reserved names.
 */
contract MezoNameRegistry {
    // ---------------------------------------------------------
    // Storage
    // ---------------------------------------------------------

    /// @notice Maps a registered name to its owning address.
    mapping(string => address) public nameToAddress;

    /// @notice Maps an address to its currently registered name.
    mapping(address => string) public addressToName;

    /// @notice Immutable set of reserved system names that cannot be registered.
    mapping(bytes32 => bool) public isReserved;

    // ---------------------------------------------------------
    // Events
    // ---------------------------------------------------------

    /// @notice Emitted when a new handle is registered.
    /// @dev `name` is intentionally unindexed so indexers and clients can read plain UTF-8 text directly.
    event NameRegistered(address indexed owner, string name);

    /// @notice Emitted when a handle is transferred to another address.
    event NameTransferred(address indexed from, address indexed to, string name);

    // ---------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------

    constructor() {
        // Reserve critical protocol, system, and administration handles
        _reserveName("admin");
        _reserveName("mezo");
        _reserveName("support");
        _reserveName("system");
        _reserveName("faucet");
        _reserveName("treasury");
        _reserveName("mod");
    }

    // ---------------------------------------------------------
    // External Registration & Transfer
    // ---------------------------------------------------------

    /**
     * @notice Registers a unique human-readable handle for the caller.
     * @param name The requested name (lowercase a-z, 0-9, and underscore; 3-20 chars).
     */
    function registerName(string calldata name) external {
        bytes calldata nameBytes = bytes(name);
        uint256 len = nameBytes.length;

        require(len >= 3, "Name too short: min 3 chars");
        require(len <= 20, "Name too long: max 20 chars");

        // Validate characters: only 'a'-'z', '0'-'9', and '_'
        for (uint256 i = 0; i < len; i++) {
            bytes1 b = nameBytes[i];
            bool isLower = (b >= 0x61 && b <= 0x7a); // 'a'..'z'
            bool isDigit = (b >= 0x30 && b <= 0x39); // '0'..'9'
            bool isUnderscore = (b == 0x5f);         // '_'
            require(isLower || isDigit || isUnderscore, "Invalid character: only a-z, 0-9, _ allowed");
        }

        // Check reserved names
        bytes32 nameHash = keccak256(nameBytes);
        require(!isReserved[nameHash], "Name is reserved");

        // Check availability
        require(nameToAddress[name] == address(0), "Name already taken");

        // Ensure caller does not already own an active handle
        require(bytes(addressToName[msg.sender]).length == 0, "Address already has a registered name");

        // Register
        nameToAddress[name] = msg.sender;
        addressToName[msg.sender] = name;

        emit NameRegistered(msg.sender, name);
    }

    /**
     * @notice Transfers the caller's registered handle to another address.
     * @param to The recipient address (must not already own a handle).
     */
    function transferName(address to) external {
        require(to != address(0), "Cannot transfer to zero address");
        require(to != msg.sender, "Cannot transfer to oneself");

        string memory name = addressToName[msg.sender];
        require(bytes(name).length > 0, "Sender has no registered name");
        require(bytes(addressToName[to]).length == 0, "Recipient already has a registered name");

        // Reassign
        nameToAddress[name] = to;
        addressToName[to] = name;
        delete addressToName[msg.sender];

        emit NameTransferred(msg.sender, to, name);
    }

    // ---------------------------------------------------------
    // View Functions
    // ---------------------------------------------------------

    /**
     * @notice Checks if a name is valid and available for registration.
     */
    function isNameAvailable(string calldata name) external view returns (bool) {
        bytes calldata nameBytes = bytes(name);
        uint256 len = nameBytes.length;

        if (len < 3 || len > 20) return false;

        for (uint256 i = 0; i < len; i++) {
            bytes1 b = nameBytes[i];
            bool isLower = (b >= 0x61 && b <= 0x7a);
            bool isDigit = (b >= 0x30 && b <= 0x39);
            bool isUnderscore = (b == 0x5f);
            if (!isLower && !isDigit && !isUnderscore) return false;
        }

        if (isReserved[keccak256(nameBytes)]) return false;
        if (nameToAddress[name] != address(0)) return false;

        return true;
    }

    /**
     * @notice Resolves a name string to its owner address.
     */
    function resolveName(string calldata name) external view returns (address) {
        return nameToAddress[name];
    }

    /**
     * @notice Resolves an address to its registered name string.
     */
    function resolveAddress(address addr) external view returns (string memory) {
        return addressToName[addr];
    }

    // ---------------------------------------------------------
    // Internal Helpers
    // ---------------------------------------------------------

    function _reserveName(string memory name) internal {
        isReserved[keccak256(bytes(name))] = true;
    }
}
