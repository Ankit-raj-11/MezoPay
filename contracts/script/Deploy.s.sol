// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/MezoNameRegistry.sol";
import "../src/MezoPaymentCore.sol";
import "../src/MockPaymentTarget.sol";

contract DeployScript is Script {
    // Official verified MUSD token address on Mezo Testnet (Chain ID 31611)
    address public constant MUSD_TESTNET = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;

    function run() external {
        uint256 deployerPrivateKey = 0;
        try vm.envBytes32("PRIVATE_KEY") returns (bytes32 pkBytes) {
            deployerPrivateKey = uint256(pkBytes);
        } catch {
            try vm.envUint("PRIVATE_KEY") returns (uint256 pkUint) {
                deployerPrivateKey = pkUint;
            } catch {
                deployerPrivateKey = 0;
            }
        }
        
        if (deployerPrivateKey != 0) {
            console.log("Broadcasting with account:", vm.addr(deployerPrivateKey));
            vm.startBroadcast(deployerPrivateKey);
        } else {
            console.log("Warning: No private key found in env, using default sender");
            vm.startBroadcast();
        }

        console.log("--------------------------------------------------");
        console.log("Deploying MezoPay Smart Contracts to Mezo Testnet");
        console.log("Chain ID:", block.chainid);
        console.log("--------------------------------------------------");

        // 1. Deploy MezoNameRegistry
        MezoNameRegistry registry = new MezoNameRegistry();
        console.log("MezoNameRegistry deployed at:", address(registry));

        // 2. Deploy MezoPaymentCore bound to official MUSD token
        MezoPaymentCore core = new MezoPaymentCore(MUSD_TESTNET);
        console.log("MezoPaymentCore deployed at:", address(core));

        // 3. Deploy MockPaymentTarget (useful for policy spikes)
        MockPaymentTarget mockTarget = new MockPaymentTarget();
        console.log("MockPaymentTarget deployed at:", address(mockTarget));

        vm.stopBroadcast();

        console.log("--------------------------------------------------");
        console.log("Deployment Complete!");
        console.log("MUSD Token:", MUSD_TESTNET);
        console.log("MezoNameRegistry:", address(registry));
        console.log("MezoPaymentCore:", address(core));
        console.log("MockPaymentTarget:", address(mockTarget));
        console.log("--------------------------------------------------");
    }
}
