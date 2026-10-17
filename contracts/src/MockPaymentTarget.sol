// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title MockPaymentTarget
/// @notice 10-line placeholder target for Spike 1 to verify Privy/Dynamic scoped signing policies
contract MockPaymentTarget {
    event MockPaymentExecuted(address indexed payer, address indexed payee, uint256 amount);

    function payDirect(address payee, uint256 amount, string calldata /* note */) external {
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Invalid amount");
        emit MockPaymentExecuted(msg.sender, payee, amount);
    }
}
