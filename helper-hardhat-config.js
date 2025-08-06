const { ethers } = require("hardhat")

const networkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2Plus: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B", // Updated to v2.5 coordinator
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // Updated gas lane for v2.5
        subscriptionId:
            "54557647894630960898604562076359003379284596268715729073031521891914113887506", // You'll need to create a new v2.5 subscription
        callbackGasLimit: "300000",
        interval: "30",
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", //doesnt matter for local network what it is
        callbackGasLimit: "2500000",
        interval: "30",
    },
}

const frontEndContractsFile = "../raffle-frontend/constants/contractAddresses.json"
const frontEndAbiFile = "../raffle-frontend/constants/abi.json"

const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains,
    frontEndContractsFile,
    frontEndAbiFile,
}
