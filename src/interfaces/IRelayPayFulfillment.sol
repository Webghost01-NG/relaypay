// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRelayPayFulfillment
 * @notice Callback interface for merchant contracts to handle automated digital fulfillment
 */
interface IRelayPayFulfillment {
    /**
     * @notice Triggered by RelayPay when an invoice is successfully verified and fulfilled
     * @param invoiceId The unique identifier of the fulfilled invoice
     * @param payer The EVM caller / address executing the verification
     * @param paidAmountDrops Total XRP drops paid
     * @param payloadHash The merchant payload hash bound to the invoice
     */
    function onRelayPayFulfill(bytes32 invoiceId, address payer, uint256 paidAmountDrops, bytes32 payloadHash)
        external
        returns (bool);
}
