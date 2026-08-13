// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RelayPayInvoiceRegistry} from "../src/RelayPayInvoiceRegistry.sol";

/**
 * @notice Deployment script for RelayPay on Flare Coston2 Testnet (or Flare Mainnet)
 *
 * Usage:
 *   export PRIVATE_KEY=0xYOUR_PRIVATE_KEY
 *   forge script script/DeployRelayPay.s.sol:DeployRelayPay \
 *     --rpc-url https://coston2-api.flare.network/ext/C/rpc \
 *     --broadcast --verify
 *
 * System Contract Addresses (Coston2 Testnet):
 *   FlareContractRegistry: 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019
 *   FdcVerification:        Resolved via registry (or env FDC_VERIFICATION_ADDRESS)
 *   FtsoV2:                 Resolved via registry (or env FTSO_V2_ADDRESS)
 */
contract DeployRelayPay is Script {
    // Flare Contract Registry — same address on all Flare networks
    address constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    function run() external returns (address registry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Resolve Flare system contract addresses from env or use Coston2 defaults
        // These are the official Coston2 precompiled addresses
        address fdcVerification =
            vm.envOr("FDC_VERIFICATION_ADDRESS", address(0x1000000000000000000000000000000000000003));
        address ftsoV2 = vm.envOr("FTSO_V2_ADDRESS", address(0x3d893C53D9e8056135C26C8c638B76C8b60Df726));

        // XRP/USD Feed ID: category byte 0x01 + "XRP/USD" encoded
        bytes21 xrpUsdFeedId = bytes21(
            vm.envOr("XRP_USD_FEED_ID", bytes32(hex"0158525000000000000000000000000000000000000000000000000000000000"))
        );

        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("FDC Verification:", fdcVerification);
        console.log("FTSO v2:", ftsoV2);

        vm.startBroadcast(deployerPrivateKey);

        RelayPayInvoiceRegistry relayPay = new RelayPayInvoiceRegistry(fdcVerification, ftsoV2, xrpUsdFeedId);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("RelayPayInvoiceRegistry:", address(relayPay));
        console.log("RelayPayReceipt (NFT):", address(relayPay.receiptContract()));
        console.log("========================================");

        return address(relayPay);
    }
}
