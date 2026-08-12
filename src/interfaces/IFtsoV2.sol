// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFtsoV2
 * @notice Standard Flare Time Series Oracle v2 interface for feed values
 */
interface IFtsoV2 {
    /**
     * @notice Get feed value by feed ID
     * @param feedId The 21-byte Feed ID (e.g. XRP/USD)
     * @return value The price value
     * @return decimals The decimal precision of value
     * @return timestamp The timestamp when feed value was updated
     */
    function getFeedValue(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint256 timestamp);
}
