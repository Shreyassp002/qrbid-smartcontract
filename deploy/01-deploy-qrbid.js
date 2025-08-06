const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    log("----------------------------------------------------")
    log("Deploying QRBid contract...")
    log("Network:", network.name)
    log("Chain ID:", chainId)
    log("Deployer:", deployer)

    // Platform wallet is deployer
    const platformWallet = deployer 
    
    const args = [platformWallet]

    const qrBid = await deploy("QRBid", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    log("QRBid deployed to:", qrBid.address)
    log("Platform wallet:", platformWallet)

    
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying contract...")
        await verify(qrBid.address, args)
    }
    
    log("----------------------------------------------------")
}

module.exports.tags = ["all", "qrbid"]