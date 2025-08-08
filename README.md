[![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.19-brightgreen.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-Contracts-blue.svg)](https://openzeppelin.com/contracts/)

# QRBid Smart Contracts

> **QRBid** - A decentralized auction platform where users bid ETH to control a QR code's destination URL for 24 hours.

## 🎯 Project Overview

QRBid is a Web3 platform that gamifies QR code control through Ethereum-based auctions. Users compete to determine where a public QR code redirects, creating an engaging blend of blockchain technology and interactive marketing.

### How It Works

1. **Auction Phase**: Users bid ETH and submit their desired redirect URL
2. **Winner Selection**: Highest bidder wins when auction ends (24 hours)
3. **URL Control**: Winner's URL becomes the QR code destination immediately
4. **Auto-Restart**: New auction begins automatically for the next 24-hour cycle
5. **Refunds**: All non-winning bids are automatically refunded

## Tech Stack

- **Smart Contracts**: Solidity ^0.8.19
- **Development Framework**: Hardhat
- **Testing**: Hardhat + Chai + Ethers.js
- **Network**: Ethereum (Mainnet/Sepolia)

## Prerequisites

- Node.js >= 16.0.0
- yarn
- Basic understanding of Solidity and Ethereum 

## Installation

```bash
# Clone the repository
git clone https://github.com/Shreyassp002/qrbid-smartcontract.git
cd qrbid-smartcontract

# Install dependencies
yarn install

```


### QRBidAuction.sol

- **Timed Auctions**: Automated 24-hour auction cycles
- **Bid Management**: ETH bidding with automatic refunds
- **URL Storage**: Secure storage of winner's redirect URL
- **Access Control**: Owner functions for emergency controls
- **Gas Optimization**: Efficient bid processing and refunds


## Testing

```bash
# Run all tests
yarn test

# Generate coverage report
yarn coverage
```

### Test Coverage Areas

- ✅ Bid placement and validation
- ✅ Auction timing and transitions
- ✅ Refund mechanisms
- ✅ Access controls
- ✅ Edge cases and error handling

## Deployment

### Local Development

```bash
# Start local Hardhat network
yarn hardhat node

# Deploy to local network
yarn hardhat deploy --network localhost
```

### Testnet Deployment

```bash
# Deploy to Sepolia testnet
yarn hardhat deply --network sepolia

# Verify contract on Etherscan
yarn hardhat verify --network sepolia 
```

