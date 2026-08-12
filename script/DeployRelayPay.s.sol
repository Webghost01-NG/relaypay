// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script, console } from "forge-std/Script.sol";
import { RelayPayInvoiceRegistry } from "../src/RelayPayInvoiceRegistry.sol";

contract DeployRelayPay is Script {
    function run() external returns (address registry) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        
        // Flare Coston2 Testnet default contract addresses
        address fdcVerification = vm.envOr("FDC_VERIFICATION_ADDRESS", address(0x1000000000000000000000000000000000000001));
        address ftsoV2 = vm.envOr("FTSO_V2_ADDRESS", address(0x1000000000000000000000000000000000000002));
        bytes21 xrpUsdFeedId = bytes21(vm.envOr("XRP_USD_FEED_ID", bytes32(abi.encodePacked("XRP/USD"))));

        vm.startBroadcast(deployerPrivateKey);

        RelayPayInvoiceRegistry relayPay = new RelayPayInvoiceRegistry(
            fdcVerification,
            ftsoV2,
            xrpUsdFeedId
        );

        vm.stopBroadcast();

        console.log("RelayPayInvoiceRegistry deployed to:", address(relayPay));
        return address(relayPay);
    }
}
