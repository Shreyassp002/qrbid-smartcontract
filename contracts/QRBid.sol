// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QRBid is ReentrancyGuard, Ownable {
    address public s_platformWallet;
    uint256 public s_auctionCounter;
    uint256 public constant AUCTION_DURATION = 24 hours;

    constructor(address _platformWallet) Ownable(msg.sender) {
        s_platformWallet = _platformWallet;
        s_auctionCounter = 0;
    }

    struct Auction {
        uint256 startingTime;
        uint256 endingTime;
        uint256 highestBid;
        address highestBidder;
        string preferredUrl;
        bool isEnded;
    }

    Auction public s_currentAuction;

    function placeBid(string calldata _preferredUrl) external payable nonReentrant {
        require(block.timestamp < s_currentAuction.endingTime, "Auction ended");
        require(msg.value > s_currentAuction.highestBid, "Bid too low");
        require(bytes(_preferredUrl).length > 0, "URL cannot be empty");

        if (s_currentAuction.highestBidder != address(0)) {
            payable(s_currentAuction.highestBidder).transfer(s_currentAuction.highestBid);
        }
        s_currentAuction.highestBid = msg.value;
        s_currentAuction.highestBidder = msg.sender;
        s_currentAuction.preferredUrl = _preferredUrl;
    }
}
