const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("QRBid Unit Tests", function () {
          let qrBid, deployer, player1, player2
          const AUCTION_DURATION = 24 * 60 * 60 // 24 hours in seconds
          const MIN_BID_INCREMENT = ethers.parseEther("0.001")
          const MIN_STARTING_BID = ethers.parseEther("0.01")

          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              player1 = accounts[1]
              player2 = accounts[2]

              await deployments.fixture(["qrbid"])
              const qrBidDeployment = await deployments.get("QRBid")
              qrBid = await ethers.getContractAt("QRBid", qrBidDeployment.address)
          })

          describe("Constructor", function () {
              it("initializes the contract correctly", async () => {
                  const platformWallet = await qrBid.i_platformWallet()
                  const auctionCounter = await qrBid.s_auctionCounter()
                  const minBidIncrement = await qrBid.minBidIncrement()

                  assert.equal(platformWallet, deployer.address)
                  assert.equal(auctionCounter.toString(), "0")
                  assert.equal(minBidIncrement.toString(), MIN_BID_INCREMENT.toString())
              })
          })

          describe("startAuction", function () {
              it("only owner can start auction", async () => {
                  await expect(qrBid.connect(player1).startAuction()).to.be.reverted
              })

              it("starts auction correctly", async () => {
                  await qrBid.startAuction()

                  const currentAuction = await qrBid.s_currentAuction()
                  const auctionCounter = await qrBid.s_auctionCounter()
                  const isActive = await qrBid.isAuctionActive()

                  assert.equal(auctionCounter.toString(), "1")
                  assert.equal(currentAuction.highestBid.toString(), "0")
                  assert.equal(currentAuction.highestBidder, ethers.ZeroAddress)
                  assert.equal(currentAuction.isEnded, false)
                  assert.equal(isActive, true)
              })

              it("emits AuctionStarted event", async () => {
                  await expect(qrBid.startAuction()).to.emit(qrBid, "AuctionStarted")
              })
          })

          describe("placeBid", function () {
              beforeEach(async () => {
                  await qrBid.startAuction()
              })

              it("reverts if auction not active", async () => {
                  // Fast forward time past auction end
                  await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                  await network.provider.send("evm_mine", [])

                  await expect(
                      qrBid.connect(player1).placeBid("https://example.com", {
                          value: MIN_STARTING_BID,
                      }),
                  ).to.be.revertedWith("Auction ended")
              })

              it("reverts if bid too low (first bid)", async () => {
                  await expect(
                      qrBid.connect(player1).placeBid("https://example.com", {
                          value: ethers.parseEther("0.005"),
                      }),
                  ).to.be.revertedWith("Bid too low")
              })

              it("reverts if URL is empty", async () => {
                  await expect(
                      qrBid.connect(player1).placeBid("", {
                          value: MIN_STARTING_BID,
                      }),
                  ).to.be.revertedWith("URL cannot be empty")
              })

              it("accepts first valid bid", async () => {
                  const bidAmount = MIN_STARTING_BID
                  const url = "https://example.com"

                  await qrBid.connect(player1).placeBid(url, { value: bidAmount })

                  const currentAuction = await qrBid.s_currentAuction()
                  const currentUrl = await qrBid.getCurrentUrl()

                  assert.equal(currentAuction.highestBid.toString(), bidAmount.toString())
                  assert.equal(currentAuction.highestBidder, player1.address)
                  assert.equal(currentUrl, url)
              })

              it("refunds previous bidder", async () => {
                  const firstBid = MIN_STARTING_BID
                  const secondBid = firstBid + MIN_BID_INCREMENT

                  // Player1 bids
                  await qrBid.connect(player1).placeBid("https://player1.com", { value: firstBid })

                  const player1BalanceBefore = await ethers.provider.getBalance(player1.address)

                  // Player2 outbids
                  await qrBid.connect(player2).placeBid("https://player2.com", { value: secondBid })

                  const player1BalanceAfter = await ethers.provider.getBalance(player1.address)
                  const difference = player1BalanceAfter - player1BalanceBefore

                  assert.equal(difference.toString(), firstBid.toString())
              })

              it("emits BidPlaced event", async () => {
                  const bidAmount = MIN_STARTING_BID
                  const url = "https://example.com"

                  await expect(qrBid.connect(player1).placeBid(url, { value: bidAmount }))
                      .to.emit(qrBid, "BidPlaced")
                      .withArgs(player1.address, bidAmount, url, 1, anyValue)
              })
          })

          describe("endAuction", function () {
              beforeEach(async () => {
                  await qrBid.startAuction()
                  await qrBid.connect(player1).placeBid("https://winner.com", {
                      value: MIN_STARTING_BID,
                  })
              })

              it("reverts if auction not ended", async () => {
                  await expect(qrBid.endAuction()).to.be.revertedWith("Auction not ended")
              })

              it("ends auction and transfers money to platform", async () => {
                  // Fast forward time
                  await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                  await network.provider.send("evm_mine", [])

                  const deployerBalanceBefore = await ethers.provider.getBalance(deployer.address)

                  const tx = await qrBid.endAuction()
                  const receipt = await tx.wait(1)
                  const gasUsed = receipt.gasUsed * receipt.gasPrice

                  const deployerBalanceAfter = await ethers.provider.getBalance(deployer.address)
                  const difference = deployerBalanceAfter - deployerBalanceBefore + gasUsed

                  assert.equal(difference.toString(), MIN_STARTING_BID.toString())
              })

              it("marks auction as ended", async () => {
                  await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                  await network.provider.send("evm_mine", [])

                  await qrBid.endAuction()
                  const currentAuction = await qrBid.s_currentAuction()

                  assert.equal(currentAuction.isEnded, true)
              })

              it("emits AuctionEnded event", async () => {
                  await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                  await network.provider.send("evm_mine", [])

                  await expect(qrBid.endAuction()).to.emit(qrBid, "AuctionEnded")
              })
          })

          describe("Admin Functions", function () {
              it("owner can set min bid increment", async () => {
                  const newIncrement = ethers.parseEther("0.002")
                  await qrBid.setMinBidIncrement(newIncrement)

                  const minBidIncrement = await qrBid.minBidIncrement()
                  assert.equal(minBidIncrement.toString(), newIncrement.toString())
              })

              it("non-owner cannot set min bid increment", async () => {
                  await expect(
                      qrBid.connect(player1).setMinBidIncrement(ethers.parseEther("0.002")),
                  ).to.be.reverted
              })

              it("owner can set min starting bid", async () => {
                  const newStartingBid = ethers.parseEther("0.02")
                  await qrBid.setMinStartingBid(newStartingBid)

                  const minStartingBid = await qrBid.minStartingBid()
                  assert.equal(minStartingBid.toString(), newStartingBid.toString())
              })
          })

          describe("View Functions", function () {
              beforeEach(async () => {
                  await qrBid.startAuction()
                  await qrBid.connect(player1).placeBid("https://test.com", {
                      value: MIN_STARTING_BID,
                  })
              })

              it("getCurrentUrl returns current winning URL", async () => {
                  const currentUrl = await qrBid.getCurrentUrl()
                  assert.equal(currentUrl, "https://test.com")
              })

              it("getTimeRemaining returns correct time", async () => {
                  const timeRemaining = await qrBid.getTimeRemaining()
                  assert.isTrue(timeRemaining > 0)
              })

              it("isAuctionActive returns true when active", async () => {
                  const isActive = await qrBid.isAuctionActive()
                  assert.equal(isActive, true)
              })

              it("isAuctionActive returns false when ended", async () => {
                  await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                  await network.provider.send("evm_mine", [])

                  const isActive = await qrBid.isAuctionActive()
                  assert.equal(isActive, false)
              })
          })
      })
