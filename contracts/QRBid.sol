// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QRBid is ReentrancyGuard, Ownable {
    address public immutable i_platformWallet;
    uint256 public s_auctionCounter;
    uint256 public constant AUCTION_DURATION = 24 hours;
    uint256 public minBidIncrement = 0.001 ether;
    uint256 public minStartingBid = 0.01 ether;

    constructor(address _platformWallet) Ownable(msg.sender) {
        i_platformWallet = _platformWallet;
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

    event BidPlaced(
        address indexed bidder,
        uint256 amount,
        string url,
        uint256 indexed auctionId,
        uint256 timestamp
    );

    event AuctionStarted(uint256 indexed auctionId, uint256 startTime, uint256 endTime);

    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningAmount,
        string winningUrl,
        uint256 timestamp
    );

    Auction public s_currentAuction;

    function placeBid(string calldata _preferredUrl) external payable nonReentrant {
        require(block.timestamp < s_currentAuction.endingTime, "Auction ended");
        uint256 minimumBid = s_currentAuction.highestBid == 0
            ? minStartingBid
            : s_currentAuction.highestBid + minBidIncrement;
        require(msg.value >= minimumBid, "Bid too low");
        require(bytes(_preferredUrl).length > 0, "URL cannot be empty");

        if (s_currentAuction.highestBidder != address(0)) {
            payable(s_currentAuction.highestBidder).transfer(s_currentAuction.highestBid);
        }
        s_currentAuction.highestBid = msg.value;
        s_currentAuction.highestBidder = msg.sender;
        s_currentAuction.preferredUrl = _preferredUrl;

        emit BidPlaced(msg.sender, msg.value, _preferredUrl, s_auctionCounter, block.timestamp);
    }

    function startAuction() external onlyOwner {
        s_currentAuction = Auction({
            startingTime: block.timestamp,
            endingTime: block.timestamp + AUCTION_DURATION,
            highestBid: 0,
            highestBidder: address(0),
            preferredUrl: "",
            isEnded: false
        });
        s_auctionCounter++;

        emit AuctionStarted(s_auctionCounter, block.timestamp, s_currentAuction.endingTime);
    }

    function endAuction() external {
        require(block.timestamp > s_currentAuction.endingTime, "Auction not ended");
        require(!s_currentAuction.isEnded, "Auction already ended");
        if (s_currentAuction.highestBidder != address(0)) {
            payable(i_platformWallet).transfer(s_currentAuction.highestBid);
        }
        s_currentAuction.isEnded = true;

        emit AuctionEnded(
            s_auctionCounter,
            s_currentAuction.highestBidder,
            s_currentAuction.highestBid,
            s_currentAuction.preferredUrl,
            block.timestamp
        );
    }

    function setMinBidIncrement(uint256 _newIncrement) external onlyOwner {
        minBidIncrement = _newIncrement;
    }

    function setMinStartingBid(uint256 _newStartingBid) external onlyOwner {
        minStartingBid = _newStartingBid;
    }

    function getCurrentUrl() external view returns (string memory) {
        return s_currentAuction.preferredUrl;
    }

    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= s_currentAuction.endingTime) {
            return 0;
        }
        return s_currentAuction.endingTime - block.timestamp;
    }

    function isAuctionActive() external view returns (bool) {
        return block.timestamp < s_currentAuction.endingTime && !s_currentAuction.isEnded;
    }
}
