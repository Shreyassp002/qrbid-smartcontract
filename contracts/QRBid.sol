// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QRBid is ReentrancyGuard, Ownable {
    address public immutable i_platformWallet;
    uint256 public s_auctionCounter;
    uint256 public constant AUCTION_DURATION = 24 hours;
    uint256 public constant URL_DISPLAY_DURATION = 24 hours;
    uint256 public minBidIncrement = 0.001 ether;
    uint256 public minStartingBid = 0.01 ether;

    constructor(address _platformWallet) Ownable(msg.sender) {
        i_platformWallet = _platformWallet;
        s_auctionCounter = 0;
    }

    struct Auction {
        uint256 auctionId;
        uint256 startingTime;
        uint256 endingTime;
        uint256 highestBid;
        address highestBidder;
        string preferredUrl;
        bool isEnded;
        uint256 urlExpiryTime;
    }

    // Current auction for bidding
    Auction public s_currentAuction;

    // Last completed auction
    Auction public s_lastCompletedAuction;

    // Store all auctions
    mapping(uint256 => Auction) public auctions;

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
        uint256 timestamp,
        uint256 urlExpiryTime
    );

    function placeBid(string calldata _preferredUrl) external payable nonReentrant {
        require(block.timestamp < s_currentAuction.endingTime, "Auction ended");
        require(s_currentAuction.startingTime > 0, "No active auction");

        uint256 minimumBid = s_currentAuction.highestBid == 0
            ? minStartingBid
            : s_currentAuction.highestBid + minBidIncrement;
        require(msg.value >= minimumBid, "Bid too low");
        require(bytes(_preferredUrl).length > 0, "URL cannot be empty");

        // Refund previous highest bidder
        if (s_currentAuction.highestBidder != address(0)) {
            payable(s_currentAuction.highestBidder).transfer(s_currentAuction.highestBid);
        }

        s_currentAuction.highestBid = msg.value;
        s_currentAuction.highestBidder = msg.sender;
        s_currentAuction.preferredUrl = _preferredUrl;

        emit BidPlaced(
            msg.sender,
            msg.value,
            _preferredUrl,
            s_currentAuction.auctionId,
            block.timestamp
        );
    }

    function startAuction() external onlyOwner {
        // End current auction if it exists and hasn't been ended
        if (s_currentAuction.startingTime > 0 && !s_currentAuction.isEnded) {
            _endCurrentAuction();
        }

        s_auctionCounter++;

        s_currentAuction = Auction({
            auctionId: s_auctionCounter,
            startingTime: block.timestamp,
            endingTime: block.timestamp + AUCTION_DURATION,
            highestBid: 0,
            highestBidder: address(0),
            preferredUrl: "",
            isEnded: false,
            urlExpiryTime: 0
        });

        emit AuctionStarted(s_auctionCounter, block.timestamp, s_currentAuction.endingTime);
    }

    function endAuction() external {
        require(s_currentAuction.startingTime > 0, "No auction to end");
        require(block.timestamp > s_currentAuction.endingTime, "Auction not ended");
        require(!s_currentAuction.isEnded, "Auction already ended");

        _endCurrentAuction();
    }

    function _endCurrentAuction() private {
        // Transfer winning bid to platform
        if (s_currentAuction.highestBidder != address(0)) {
            payable(i_platformWallet).transfer(s_currentAuction.highestBid);
        }

        s_currentAuction.isEnded = true;
        s_currentAuction.urlExpiryTime = block.timestamp + URL_DISPLAY_DURATION;

        // Store completed auction
        auctions[s_currentAuction.auctionId] = s_currentAuction;
        s_lastCompletedAuction = s_currentAuction;

        emit AuctionEnded(
            s_currentAuction.auctionId,
            s_currentAuction.highestBidder,
            s_currentAuction.highestBid,
            s_currentAuction.preferredUrl,
            block.timestamp,
            s_currentAuction.urlExpiryTime
        );
    }

    // FOR QR CODE: Only shows winner URL during 24h display period or empty (for default)
    function getQRUrl() external view returns (string memory) {
        // Only show winner URL during 24h display period
        if (
            s_lastCompletedAuction.isEnded &&
            block.timestamp < s_lastCompletedAuction.urlExpiryTime &&
            bytes(s_lastCompletedAuction.preferredUrl).length > 0
        ) {
            return s_lastCompletedAuction.preferredUrl;
        }

        // Return empty - frontend will show default URL
        return "";
    }

    // FOR AUCTION DISPLAY: Only returns current auction URL
    function getCurrentAuctionUrl() external view returns (string memory) {
        if (isAuctionActive() && bytes(s_currentAuction.preferredUrl).length > 0) {
            return s_currentAuction.preferredUrl;
        }
        return "";
    }

    // Check if QR has any URL currently active (auction or winner)
    function hasActiveQRUrl() external view returns (bool) {
        return bytes(this.getQRUrl()).length > 0;
    }

    // Get the source of QR URL for display purposes
    function getQRUrlStatus() external view returns (string memory status, string memory source) {
        if (isAuctionActive() && bytes(s_currentAuction.preferredUrl).length > 0) {
            return ("auction_active", "Current Auction");
        }

        if (
            s_lastCompletedAuction.isEnded &&
            block.timestamp < s_lastCompletedAuction.urlExpiryTime &&
            bytes(s_lastCompletedAuction.preferredUrl).length > 0
        ) {
            return ("winner_display", "Winner Display");
        }

        return ("default", "Default");
    }

    // Get QR URL expiry time
    function getQRUrlExpiryTime() external view returns (uint256) {
        // If showing auction URL, expiry is auction end + display duration
        if (isAuctionActive() && bytes(s_currentAuction.preferredUrl).length > 0) {
            return s_currentAuction.endingTime + URL_DISPLAY_DURATION;
        }

        // If showing winner URL, return its expiry time
        if (
            s_lastCompletedAuction.isEnded && block.timestamp < s_lastCompletedAuction.urlExpiryTime
        ) {
            return s_lastCompletedAuction.urlExpiryTime;
        }

        return 0;
    }

    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= s_currentAuction.endingTime) {
            return 0;
        }
        return s_currentAuction.endingTime - block.timestamp;
    }

    function isAuctionActive() public view returns (bool) {
        return
            s_currentAuction.startingTime > 0 &&
            block.timestamp < s_currentAuction.endingTime &&
            !s_currentAuction.isEnded;
    }

    // Get specific auction details
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    // Admin functions
    function setMinBidIncrement(uint256 _newIncrement) external onlyOwner {
        minBidIncrement = _newIncrement;
    }

    function setMinStartingBid(uint256 _newStartingBid) external onlyOwner {
        minStartingBid = _newStartingBid;
    }
}
