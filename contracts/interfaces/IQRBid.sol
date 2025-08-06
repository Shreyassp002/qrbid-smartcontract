// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IQRBid {
    function placeBid(string calldata _preferredUrl) external payable;

    function startAuction() external;

    function endAuction() external;

    function getCurrentUrl() external view returns (string memory);

    function getTimeRemaining() external view returns (uint256);

    function isAuctionActive() external view returns (bool);
}
