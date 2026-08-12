// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IFlareDataConnector } from "../interfaces/IFlareDataConnector.sol";

/**
 * @title MockFdcVerification
 * @notice Mock implementation of Flare Data Connector verification for local testing & simulations
 */
contract MockFdcVerification is IFlareDataConnector {

    bool public shouldPassValidation = true;
    mapping(bytes32 => bool) public invalidTxHashes;

    function setShouldPassValidation(bool _pass) external {
        shouldPassValidation = _pass;
    }

    function setInvalidTxHash(bytes32 _txHash, bool _invalid) external {
        invalidTxHashes[_txHash] = _invalid;
    }

    function verifyPayment(PaymentAttestation calldata attestation) external view override returns (bool) {
        if (!shouldPassValidation) return false;
        if (invalidTxHashes[attestation.response.transactionHash]) return false;
        return attestation.response.status;
    }
}
