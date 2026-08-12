// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IFtsoV2 } from "../interfaces/IFtsoV2.sol";

/**
 * @title MockFtsoV2
 * @notice Mock implementation of Flare Time Series Oracle v2 for unit testing
 */
contract MockFtsoV2 is IFtsoV2 {

    uint256 public mockPrice;
    int8 public mockDecimals;
    uint256 public mockTimestamp;

    constructor(uint256 _price, int8 _decimals) {
        mockPrice = _price;
        mockDecimals = _decimals;
        mockTimestamp = block.timestamp;
    }

    function setMockPrice(uint256 _price, int8 _decimals, uint256 _timestamp) external {
        mockPrice = _price;
        mockDecimals = _decimals;
        mockTimestamp = _timestamp;
    }

    function getFeedValue(bytes21) external view override returns (uint256, int8, uint256) {
        return (mockPrice, mockDecimals, mockTimestamp == 0 ? block.timestamp : mockTimestamp);
    }

    function getFeedById(bytes21) external view override returns (uint256, int8, uint64) {
        return (mockPrice, mockDecimals, uint64(mockTimestamp == 0 ? block.timestamp : mockTimestamp));
    }
}
