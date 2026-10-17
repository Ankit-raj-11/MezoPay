// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/MezoNameRegistry.sol";

contract MezoNameRegistryTest is Test {
    MezoNameRegistry public registry;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xCC);

    event NameRegistered(address indexed owner, string name);
    event NameTransferred(address indexed from, address indexed to, string name);

    function setUp() public {
        registry = new MezoNameRegistry();
    }

    // ---------------------------------------------------------
    // Happy Path Tests
    // ---------------------------------------------------------

    function test_RegisterName_Success() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit NameRegistered(alice, "alice");
        registry.registerName("alice");

        assertEq(registry.resolveName("alice"), alice);
        assertEq(registry.resolveAddress(alice), "alice");
        assertFalse(registry.isNameAvailable("alice"));
    }

    function test_RegisterName_MinAndMaxLength() public {
        // Min length: 3 chars
        vm.prank(alice);
        registry.registerName("bob");
        assertEq(registry.resolveName("bob"), alice);

        // Max length: 20 chars
        vm.prank(bob);
        registry.registerName("abcdefghijklmnopqrst"); // 20 chars
        assertEq(registry.resolveName("abcdefghijklmnopqrst"), bob);
    }

    function test_RegisterName_AllowedCharacters() public {
        vm.prank(alice);
        registry.registerName("satoshi_2026");
        assertEq(registry.resolveName("satoshi_2026"), alice);
    }

    // ---------------------------------------------------------
    // Character & Length Validation Reverts
    // ---------------------------------------------------------

    function test_RevertWhen_NameTooShort() public {
        vm.prank(alice);
        vm.expectRevert("Name too short: min 3 chars");
        registry.registerName("al");
    }

    function test_RevertWhen_NameTooLong() public {
        vm.prank(alice);
        vm.expectRevert("Name too long: max 20 chars");
        registry.registerName("abcdefghijklmnopqrstu"); // 21 chars
    }

    function test_RevertWhen_NameContainsUppercase() public {
        vm.prank(alice);
        vm.expectRevert("Invalid character: only a-z, 0-9, _ allowed");
        registry.registerName("Alice");
    }

    function test_RevertWhen_NameContainsSymbols() public {
        vm.prank(alice);
        vm.expectRevert("Invalid character: only a-z, 0-9, _ allowed");
        registry.registerName("alice@mezo");

        vm.expectRevert("Invalid character: only a-z, 0-9, _ allowed");
        registry.registerName("alice!");

        vm.expectRevert("Invalid character: only a-z, 0-9, _ allowed");
        registry.registerName("alice-pay");
    }

    function test_RevertWhen_NameContainsSpaces() public {
        vm.prank(alice);
        vm.expectRevert("Invalid character: only a-z, 0-9, _ allowed");
        registry.registerName("ali ce");
    }

    // ---------------------------------------------------------
    // Reserved Names Reverts
    // ---------------------------------------------------------

    function test_RevertWhen_NameIsReserved() public {
        string[7] memory reserved = ["admin", "mezo", "support", "system", "faucet", "treasury", "mod"];
        for (uint256 i = 0; i < reserved.length; i++) {
            assertFalse(registry.isNameAvailable(reserved[i]));
            vm.prank(address(uint160(i + 100)));
            vm.expectRevert("Name is reserved");
            registry.registerName(reserved[i]);
        }
    }

    // ---------------------------------------------------------
    // Uniqueness & Duplicate Reverts
    // ---------------------------------------------------------

    function test_RevertWhen_NameAlreadyTaken() public {
        vm.prank(alice);
        registry.registerName("chaipoint");

        vm.prank(bob);
        vm.expectRevert("Name already taken");
        registry.registerName("chaipoint");
    }

    function test_RevertWhen_AddressAlreadyHasName() public {
        vm.prank(alice);
        registry.registerName("alice");

        vm.prank(alice);
        vm.expectRevert("Address already has a registered name");
        registry.registerName("alice2");
    }

    // ---------------------------------------------------------
    // Name Transfer Tests
    // ---------------------------------------------------------

    function test_TransferName_Success() public {
        vm.prank(alice);
        registry.registerName("alice");

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit NameTransferred(alice, bob, "alice");
        registry.transferName(bob);

        assertEq(registry.resolveName("alice"), bob);
        assertEq(registry.resolveAddress(bob), "alice");
        assertEq(registry.resolveAddress(alice), "");
    }

    function test_RevertWhen_TransferWithoutName() public {
        vm.prank(alice);
        vm.expectRevert("Sender has no registered name");
        registry.transferName(bob);
    }

    function test_RevertWhen_TransferToZeroOrSelf() public {
        vm.prank(alice);
        registry.registerName("alice");

        vm.prank(alice);
        vm.expectRevert("Cannot transfer to zero address");
        registry.transferName(address(0));

        vm.prank(alice);
        vm.expectRevert("Cannot transfer to oneself");
        registry.transferName(alice);
    }

    function test_RevertWhen_TransferToAddressWithExistingName() public {
        vm.prank(alice);
        registry.registerName("alice");

        vm.prank(bob);
        registry.registerName("bob");

        vm.prank(alice);
        vm.expectRevert("Recipient already has a registered name");
        registry.transferName(bob);
    }
}
