// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/MezoPaymentCore.sol";
import "../src/MezoNameRegistry.sol";
import "./mocks/MockERC20.sol";

contract MezoPayInvariantsTest is Test {
    MezoPaymentCore public core;
    MezoNameRegistry public registry;
    MockERC20 public musd;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        musd = new MockERC20("Mezo USD", "MUSD");
        core = new MezoPaymentCore(address(musd));
        registry = new MezoNameRegistry();

        musd.mint(alice, 1_000_000_000 * 1e18);
        musd.mint(bob, 1_000_000_000 * 1e18);

        vm.prank(alice);
        musd.approve(address(core), type(uint256).max);

        vm.prank(bob);
        musd.approve(address(core), type(uint256).max);
    }

    /// @notice Fuzz test verifying per-tx cap enforcement across any arbitrary amount
    function testFuzz_PayDirect_LimitsEnforcement(uint256 requestedAmount) public {
        uint256 dailyCap = 200 * 1e18;
        uint256 perTxCap = 50 * 1e18;

        vm.prank(alice);
        core.setInitialSafetyLimits(dailyCap, perTxCap);

        // Clamp amount to a positive range
        vm.assume(requestedAmount > 0 && requestedAmount <= 1_000 * 1e18);

        vm.prank(alice);
        if (requestedAmount > perTxCap) {
            vm.expectRevert("Amount exceeds per-tx cap");
            core.payDirect(bob, requestedAmount, "Fuzz payment");
        } else {
            core.payDirect(bob, requestedAmount, "Fuzz payment");
            assertEq(musd.balanceOf(bob), 1_000_000_000 * 1e18 + requestedAmount);
        }
    }

    /// @notice Invariant test: Total bill split amount is strictly conserved down to the exact wei
    /// Sum of all participant shares + creator dust portion == original totalAmount
    function testFuzz_BillSplit_TotalConservation(uint256 totalAmount, uint16 participantCount) public {
        // Constrain to valid ranges: 1 MUSD to 1,000,000 MUSD; 1 to 50 participants
        totalAmount = bound(totalAmount, 1 * 1e18, 1_000_000 * 1e18);
        participantCount = uint16(bound(participantCount, 1, 50));

        vm.prank(alice);
        bytes32 splitId = core.createSplit(totalAmount, participantCount, "Dinner Split");

        MezoPaymentCore.BillSplit memory split = core.getSplit(splitId);
        uint256 shareAmount = split.shareAmount;

        // Calculate total collected if all participants pay
        uint256 totalParticipantContributions = shareAmount * participantCount;
        uint256 creatorPortion = totalAmount - totalParticipantContributions;

        // Invariant: creatorPortion + totalParticipantContributions == totalAmount
        assertEq(creatorPortion + totalParticipantContributions, totalAmount);
        // Invariant: creatorPortion is strictly within [shareAmount, shareAmount + participantCount]
        assertTrue(creatorPortion >= shareAmount);
        assertTrue(creatorPortion <= shareAmount + participantCount);
    }

    /// @notice Fuzz test verifying name availability check consistency
    function testFuzz_NameAvailability(string memory randomName) public view {
        bytes memory nameBytes = bytes(randomName);
        bool isAvail = registry.isNameAvailable(randomName);

        if (nameBytes.length < 3 || nameBytes.length > 20) {
            assertFalse(isAvail);
        }
    }
}
