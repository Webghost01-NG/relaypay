// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Payment, IFdcVerification} from "../interfaces/IFlareDataConnector.sol";

/**
 * @title MockFdcVerification
 * @notice Mock implementation of Flare Data Connector verification for local testing & simulations
 */
contract MockFdcVerification is IFdcVerification {
    bool public shouldPassValidation = true;
    mapping(bytes32 => bool) public invalidTxHashes;

    function setShouldPassValidation(bool _pass) external {
        shouldPassValidation = _pass;
    }

    function setInvalidTxHash(bytes32 _txHash, bool _invalid) external {
        invalidTxHashes[_txHash] = _invalid;
    }

    function verifyPayment(Payment.Proof calldata attestation) external view override returns (bool) {
        if (!shouldPassValidation) return false;
        bytes32 ref = attestation.response.body.standardPaymentReference;
        if (invalidTxHashes[ref]) return false;
        return attestation.response.body.status;
    }
}
