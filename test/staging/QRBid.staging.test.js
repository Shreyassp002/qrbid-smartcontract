const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("QRBid Staging Tests", function () {
          let qrBid, deployer, accounts
          const AUCTION_DURATION = 24 * 60 * 60 // 24 hours in seconds
          const MIN_BID_INCREMENT = ethers.parseEther("0.001")
          const MIN_STARTING_BID = ethers.parseEther("0.01")

          before(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]

              console.log("Deploying QRBid contract...")
              console.log("Deployer address:", deployer.address)
              console.log("Network:", network.name)
              console.log("Available accounts:", accounts.length)

              // Check if we have enough accounts
              if (accounts.length < 4) {
                  console.log(
                      "⚠️  Only",
                      accounts.length,
                      "accounts available. Some tests may be skipped.",
                  )
              }

              await deployments.fixture(["qrbid"])
              const qrBidDeployment = await deployments.get("QRBid")
              qrBid = await ethers.getContractAt("QRBid", qrBidDeployment.address, deployer)

              console.log("QRBid deployed to:", await qrBid.getAddress())
          })

          describe("Contract Deployment and Initial State", function () {
              it("should deploy with correct initial parameters", async () => {
                  console.log("Testing initial contract state...")
                  console.log("Available test accounts:", accounts.length)

                  const platformWallet = await qrBid.i_platformWallet()
                  const auctionCounter = await qrBid.s_auctionCounter()
                  const minBidIncrement = await qrBid.minBidIncrement()
                  const minStartingBid = await qrBid.minStartingBid()

                  console.log(`Platform wallet: ${platformWallet}`)
                  console.log(`Auction counter: ${auctionCounter}`)
                  console.log(`Min bid increment: ${ethers.formatEther(minBidIncrement)} ETH`)
                  console.log(`Min starting bid: ${ethers.formatEther(minStartingBid)} ETH`)

                  assert.equal(platformWallet, deployer.address)
                  assert.equal(auctionCounter.toString(), "0")
                  assert.equal(minBidIncrement.toString(), MIN_BID_INCREMENT.toString())
                  assert.equal(minStartingBid.toString(), MIN_STARTING_BID.toString())
                  it("should handle single bidder scenario (when limited accounts)", async () => {
                      console.log("\n=== TESTING SINGLE BIDDER SCENARIO ===")

                      // This test works even with just the deployer account
                      console.log("Testing basic auction functionality with deployer as bidder")

                      // Start auction
                      const startTx = await qrBid.connect(deployer).startAuction()
                      await startTx.wait(1)
                      console.log("Auction started")

                      // Deployer places a bid
                      const bidAmount = MIN_STARTING_BID
                      const bidUrl = "https://deployer-test.com"

                      const bidTx = await qrBid.connect(deployer).placeBid(bidUrl, {
                          value: bidAmount,
                      })
                      await bidTx.wait(1)

                      const currentAuction = await qrBid.s_currentAuction()
                      const currentUrl = await qrBid.getCurrentUrl()

                      console.log(`Bid placed: ${ethers.formatEther(bidAmount)} ETH`)
                      console.log(`URL: ${currentUrl}`)

                      assert.equal(currentAuction.highestBid.toString(), bidAmount.toString())
                      assert.equal(currentAuction.highestBidder, deployer.address)
                      assert.equal(currentUrl, bidUrl)

                      console.log("✅ Single bidder scenario working correctly")
                  })

                  it("should have no active auction initially", async () => {
                      const isActive = await qrBid.isAuctionActive()
                      const timeRemaining = await qrBid.getTimeRemaining()

                      console.log(`Is auction active: ${isActive}`)
                      console.log(`Time remaining: ${timeRemaining}`)

                      assert.equal(isActive, false)
                      assert.equal(timeRemaining.toString(), "0")
                  })
              })

              describe("End-to-End Auction Lifecycle", function () {
                  it("should complete a full auction cycle with multiple bidders", async () => {
                      console.log("\n=== STARTING FULL AUCTION CYCLE TEST ===")

                      // Skip test if not enough accounts
                      if (accounts.length < 4) {
                          console.log(
                              "⚠️  Skipping test - need at least 4 accounts, only have",
                              accounts.length,
                          )
                          return
                      }

                      // Get initial balances
                      const initialDeployerBalance = await ethers.provider.getBalance(
                          deployer.address,
                      )
                      const bidder1 = accounts[1]
                      const bidder2 = accounts[2]
                      const bidder3 = accounts[3]

                      console.log(
                          `Initial deployer balance: ${ethers.formatEther(initialDeployerBalance)} ETH`,
                      )
                      console.log(`Bidder 1: ${bidder1.address}`)
                      console.log(`Bidder 2: ${bidder2.address}`)
                      console.log(`Bidder 3: ${bidder3.address}`)

                      // Start auction
                      console.log("\n1. Starting auction...")
                      const startTx = await qrBid.connect(deployer).startAuction()
                      const startReceipt = await startTx.wait(1)

                      const auctionCounter = await qrBid.s_auctionCounter()
                      const isActive = await qrBid.isAuctionActive()

                      console.log(`Auction #${auctionCounter} started`)
                      console.log(`Is active: ${isActive}`)
                      assert.equal(auctionCounter.toString(), "1")
                      assert.equal(isActive, true)

                      // First bid
                      console.log("\n2. Placing first bid...")
                      const firstBidAmount = MIN_STARTING_BID
                      const firstBidUrl = "https://company1.com"

                      const bid1Tx = await qrBid.connect(bidder1).placeBid(firstBidUrl, {
                          value: firstBidAmount,
                      })
                      await bid1Tx.wait(1)

                      let currentAuction = await qrBid.s_currentAuction()
                      let currentUrl = await qrBid.getCurrentUrl()

                      console.log(`First bid: ${ethers.formatEther(firstBidAmount)} ETH`)
                      console.log(`First bidder: ${bidder1.address}`)
                      console.log(`First URL: ${currentUrl}`)

                      assert.equal(currentAuction.highestBid.toString(), firstBidAmount.toString())
                      assert.equal(currentAuction.highestBidder, bidder1.address)
                      assert.equal(currentUrl, firstBidUrl)

                      // Second bid (outbid first)
                      console.log("\n3. Placing second bid (higher)...")
                      const secondBidAmount = firstBidAmount + MIN_BID_INCREMENT
                      const secondBidUrl = "https://company2.com"

                      const bidder1BalanceBefore = await ethers.provider.getBalance(bidder1.address)

                      const bid2Tx = await qrBid.connect(bidder2).placeBid(secondBidUrl, {
                          value: secondBidAmount,
                      })
                      await bid2Tx.wait(1)

                      const bidder1BalanceAfter = await ethers.provider.getBalance(bidder1.address)
                      const refundReceived = bidder1BalanceAfter - bidder1BalanceBefore

                      currentAuction = await qrBid.s_currentAuction()
                      currentUrl = await qrBid.getCurrentUrl()

                      console.log(`Second bid: ${ethers.formatEther(secondBidAmount)} ETH`)
                      console.log(`Second bidder: ${bidder2.address}`)
                      console.log(`Second URL: ${currentUrl}`)
                      console.log(
                          `Refund to first bidder: ${ethers.formatEther(refundReceived)} ETH`,
                      )

                      assert.equal(currentAuction.highestBid.toString(), secondBidAmount.toString())
                      assert.equal(currentAuction.highestBidder, bidder2.address)
                      assert.equal(currentUrl, secondBidUrl)
                      assert.equal(refundReceived.toString(), firstBidAmount.toString())

                      // Third bid (final winning bid)
                      console.log("\n4. Placing final winning bid...")
                      const thirdBidAmount = secondBidAmount + MIN_BID_INCREMENT * 2n
                      const thirdBidUrl = "https://winner-company.com"

                      const bidder2BalanceBefore = await ethers.provider.getBalance(bidder2.address)

                      const bid3Tx = await qrBid.connect(bidder3).placeBid(thirdBidUrl, {
                          value: thirdBidAmount,
                      })
                      await bid3Tx.wait(1)

                      const bidder2BalanceAfter = await ethers.provider.getBalance(bidder2.address)
                      const refund2Received = bidder2BalanceAfter - bidder2BalanceBefore

                      currentAuction = await qrBid.s_currentAuction()
                      currentUrl = await qrBid.getCurrentUrl()

                      console.log(`Final bid: ${ethers.formatEther(thirdBidAmount)} ETH`)
                      console.log(`Final bidder: ${bidder3.address}`)
                      console.log(`Final URL: ${currentUrl}`)
                      console.log(
                          `Refund to second bidder: ${ethers.formatEther(refund2Received)} ETH`,
                      )

                      assert.equal(currentAuction.highestBid.toString(), thirdBidAmount.toString())
                      assert.equal(currentAuction.highestBidder, bidder3.address)
                      assert.equal(currentUrl, thirdBidUrl)
                      assert.equal(refund2Received.toString(), secondBidAmount.toString())

                      // Verify auction is still active
                      console.log("\n5. Verifying auction state before ending...")
                      const timeRemaining = await qrBid.getTimeRemaining()
                      const stillActive = await qrBid.isAuctionActive()

                      console.log(
                          `Time remaining: ${timeRemaining} seconds (${timeRemaining / 3600} hours)`,
                      )
                      console.log(`Still active: ${stillActive}`)

                      assert.isTrue(timeRemaining > 0)
                      assert.equal(stillActive, true)

                      // Fast forward time to end auction
                      console.log("\n6. Fast forwarding time to end auction...")
                      if (network.name === "hardhat" || network.name === "localhost") {
                          await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                          await network.provider.send("evm_mine", [])
                      } else {
                          console.log(
                              "⚠️  On live network - cannot fast forward time. Auction must end naturally.",
                          )
                          console.log("This test would need to wait 24 hours on live network.")
                          return
                      }

                      const timeRemainingAfter = await qrBid.getTimeRemaining()
                      const activeAfter = await qrBid.isAuctionActive()

                      console.log(`Time remaining after fast forward: ${timeRemainingAfter}`)
                      console.log(`Active after fast forward: ${activeAfter}`)

                      assert.equal(timeRemainingAfter.toString(), "0")
                      assert.equal(activeAfter, false)

                      // End auction
                      console.log("\n7. Ending auction...")
                      const deployerBalanceBeforeEnd = await ethers.provider.getBalance(
                          deployer.address,
                      )

                      const endTx = await qrBid.connect(deployer).endAuction()
                      const receipt = await endTx.wait(1)
                      const gasUsed = receipt.gasUsed * receipt.gasPrice

                      const deployerBalanceAfterEnd = await ethers.provider.getBalance(
                          deployer.address,
                      )
                      const platformProfit =
                          deployerBalanceAfterEnd - deployerBalanceBeforeEnd + gasUsed

                      currentAuction = await qrBid.s_currentAuction()

                      console.log(`Platform profit: ${ethers.formatEther(platformProfit)} ETH`)
                      console.log(`Expected profit: ${ethers.formatEther(thirdBidAmount)} ETH`)
                      console.log(`Gas used: ${ethers.formatEther(gasUsed)} ETH`)
                      console.log(`Auction ended: ${currentAuction.isEnded}`)

                      assert.equal(platformProfit.toString(), thirdBidAmount.toString())
                      assert.equal(currentAuction.isEnded, true)

                      console.log("\n✅ FULL AUCTION CYCLE COMPLETED SUCCESSFULLY!")
                  })
              })

              describe("Multiple Auction Cycles", function () {
                  it("should handle multiple consecutive auctions", async () => {
                      console.log("\n=== TESTING MULTIPLE AUCTION CYCLES ===")

                      // Skip if not enough accounts
                      if (accounts.length < 3) {
                          console.log(
                              "⚠️  Skipping test - need at least 3 accounts, only have",
                              accounts.length,
                          )
                          return
                      }

                      const bidder1 = accounts[1]
                      const bidder2 = accounts[2]

                      // First auction cycle
                      console.log("\n1. Starting first auction...")
                      const startTx1 = await qrBid.connect(deployer).startAuction()
                      await startTx1.wait(1)

                      let auctionCounter = await qrBid.s_auctionCounter()
                      console.log(`First auction #${auctionCounter} started`)

                      await qrBid.connect(bidder1).placeBid("https://first-auction-winner.com", {
                          value: MIN_STARTING_BID,
                      })

                      // Fast forward and end first auction
                      if (network.name === "hardhat" || network.name === "localhost") {
                          await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                          await network.provider.send("evm_mine", [])
                      } else {
                          console.log("⚠️  Cannot fast forward time on live network")
                          return
                      }

                      const endTx1 = await qrBid.connect(deployer).endAuction()
                      await endTx1.wait(1)
                      console.log("First auction ended")

                      // Second auction cycle
                      console.log("\n2. Starting second auction...")
                      const startTx2 = await qrBid.connect(deployer).startAuction()
                      await startTx2.wait(1)

                      auctionCounter = await qrBid.s_auctionCounter()
                      console.log(`Second auction #${auctionCounter} started`)

                      const isActive = await qrBid.isAuctionActive()
                      const currentUrl = await qrBid.getCurrentUrl()

                      console.log(`Is active: ${isActive}`)
                      console.log(`Current URL (should be empty): "${currentUrl}"`)

                      assert.equal(auctionCounter.toString(), "2")
                      assert.equal(isActive, true)
                      assert.equal(currentUrl, "")

                      await qrBid.connect(bidder2).placeBid("https://second-auction-winner.com", {
                          value: MIN_STARTING_BID,
                      })

                      const newUrl = await qrBid.getCurrentUrl()
                      console.log(`New URL: ${newUrl}`)
                      assert.equal(newUrl, "https://second-auction-winner.com")

                      console.log("\n✅ MULTIPLE AUCTION CYCLES WORKING CORRECTLY!")
                  })
              })

              describe("Edge Cases and Error Handling", function () {
                  beforeEach(async () => {
                      // Check if we have enough accounts for these tests
                      if (accounts.length < 2) {
                          console.log(
                              "⚠️  Skipping tests - need at least 2 accounts, only have",
                              accounts.length,
                          )
                          return
                      }

                      // Only start auction if no active auction exists
                      const isActive = await qrBid.isAuctionActive()
                      if (!isActive) {
                          await qrBid.connect(deployer).startAuction()
                      }
                  })

                  it("should handle minimum bid edge cases", async () => {
                      console.log("\n=== TESTING MINIMUM BID EDGE CASES ===")

                      if (accounts.length < 2) {
                          console.log("⚠️  Skipping test - need at least 2 accounts")
                          return
                      }

                      const bidder = accounts[1]

                      // Try bid just below minimum
                      const tooLowBid = MIN_STARTING_BID - 1n
                      console.log(
                          `Attempting bid below minimum: ${ethers.formatEther(tooLowBid)} ETH`,
                      )

                      await expect(
                          qrBid.connect(bidder).placeBid("https://toolow.com", {
                              value: tooLowBid,
                          }),
                      ).to.be.revertedWith("Bid too low")

                      // Try exact minimum bid
                      console.log(
                          `Placing exact minimum bid: ${ethers.formatEther(MIN_STARTING_BID)} ETH`,
                      )
                      await qrBid.connect(bidder).placeBid("https://exactmin.com", {
                          value: MIN_STARTING_BID,
                      })

                      const currentAuction = await qrBid.s_currentAuction()
                      assert.equal(
                          currentAuction.highestBid.toString(),
                          MIN_STARTING_BID.toString(),
                      )

                      console.log("✅ Minimum bid validation working correctly")
                  })

                  it("should handle empty URL validation", async () => {
                      console.log("\n=== TESTING URL VALIDATION ===")

                      if (accounts.length < 2) {
                          console.log("⚠️  Skipping test - need at least 2 accounts")
                          return
                      }

                      const bidder = accounts[1]

                      // Try empty URL
                      await expect(
                          qrBid.connect(bidder).placeBid("", {
                              value: MIN_STARTING_BID,
                          }),
                      ).to.be.revertedWith("URL cannot be empty")

                      // Try valid URL
                      await qrBid.connect(bidder).placeBid("https://valid.com", {
                          value: MIN_STARTING_BID,
                      })

                      const currentUrl = await qrBid.getCurrentUrl()
                      assert.equal(currentUrl, "https://valid.com")

                      console.log("✅ URL validation working correctly")
                  })

                  it("should handle admin functions correctly", async () => {
                      console.log("\n=== TESTING ADMIN FUNCTIONS ===")

                      if (accounts.length < 2) {
                          console.log("⚠️  Skipping test - need at least 2 accounts")
                          return
                      }

                      const nonOwner = accounts[1]

                      // Test unauthorized access
                      await expect(
                          qrBid.connect(nonOwner).setMinBidIncrement(ethers.parseEther("0.002")),
                      ).to.be.reverted

                      await expect(
                          qrBid.connect(nonOwner).setMinStartingBid(ethers.parseEther("0.02")),
                      ).to.be.reverted

                      // Test authorized changes
                      const newIncrement = ethers.parseEther("0.002")
                      const newStartingBid = ethers.parseEther("0.02")

                      const setIncrementTx = await qrBid
                          .connect(deployer)
                          .setMinBidIncrement(newIncrement)
                      await setIncrementTx.wait(1)

                      const setStartingBidTx = await qrBid
                          .connect(deployer)
                          .setMinStartingBid(newStartingBid)
                      await setStartingBidTx.wait(1)

                      const updatedIncrement = await qrBid.minBidIncrement()
                      const updatedStartingBid = await qrBid.minStartingBid()

                      console.log(`New increment: ${ethers.formatEther(updatedIncrement)} ETH`)
                      console.log(`New starting bid: ${ethers.formatEther(updatedStartingBid)} ETH`)

                      assert.equal(updatedIncrement.toString(), newIncrement.toString())
                      assert.equal(updatedStartingBid.toString(), newStartingBid.toString())

                      console.log("✅ Admin functions working correctly")
                  })
              })

              describe("Gas Usage Analysis", function () {
                  it("should analyze gas costs for all operations", async () => {
                      console.log("\n=== GAS USAGE ANALYSIS ===")

                      if (accounts.length < 3) {
                          console.log(
                              "⚠️  Skipping test - need at least 3 accounts for gas analysis",
                          )
                          return
                      }

                      // Start auction gas cost
                      const startTx = await qrBid.connect(deployer).startAuction()
                      const startReceipt = await startTx.wait(1)
                      console.log(`Start Auction Gas: ${startReceipt.gasUsed}`)

                      // First bid gas cost
                      const bidder1 = accounts[1]
                      const bid1Tx = await qrBid.connect(bidder1).placeBid("https://test1.com", {
                          value: MIN_STARTING_BID,
                      })
                      const bid1Receipt = await bid1Tx.wait(1)
                      console.log(`First Bid Gas: ${bid1Receipt.gasUsed}`)

                      // Second bid gas cost (with refund)
                      const bidder2 = accounts[2]
                      const bid2Tx = await qrBid.connect(bidder2).placeBid("https://test2.com", {
                          value: MIN_STARTING_BID + MIN_BID_INCREMENT,
                      })
                      const bid2Receipt = await bid2Tx.wait(1)
                      console.log(`Second Bid Gas (with refund): ${bid2Receipt.gasUsed}`)

                      // End auction gas cost
                      if (network.name === "hardhat" || network.name === "localhost") {
                          await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                          await network.provider.send("evm_mine", [])
                      }

                      const endTx = await qrBid.connect(deployer).endAuction()
                      const endReceipt = await endTx.wait(1)
                      console.log(`End Auction Gas: ${endReceipt.gasUsed}`)

                      // View functions should be free
                      const gasPrice = await ethers.provider.getGasPrice()
                      console.log(`Current Gas Price: ${gasPrice} wei`)

                      const totalGas =
                          startReceipt.gasUsed +
                          bid1Receipt.gasUsed +
                          bid2Receipt.gasUsed +
                          endReceipt.gasUsed
                      const totalCost = totalGas * gasPrice

                      console.log(`Total Gas Used: ${totalGas}`)
                      console.log(`Total Cost: ${ethers.formatEther(totalCost)} ETH`)

                      console.log("✅ Gas analysis completed")
                  })
              })

              describe("Event Emission Verification", function () {
                  it("should emit all events correctly in staging environment", async () => {
                      console.log("\n=== VERIFYING EVENT EMISSIONS ===")

                      if (accounts.length < 2) {
                          console.log("⚠️  Skipping test - need at least 2 accounts")
                          return
                      }

                      const bidder = accounts[1]

                      // Start auction and check event
                      console.log("Testing AuctionStarted event...")
                      const startTx = await qrBid.connect(deployer).startAuction()
                      await expect(startTx).to.emit(qrBid, "AuctionStarted")
                      await startTx.wait(1)

                      // Place bid and check event
                      console.log("Testing BidPlaced event...")
                      const bidTx = await qrBid.connect(bidder).placeBid("https://event-test.com", {
                          value: MIN_STARTING_BID,
                      })
                      await expect(bidTx).to.emit(qrBid, "BidPlaced")
                      await bidTx.wait(1)

                      // End auction and check event
                      if (network.name === "hardhat" || network.name === "localhost") {
                          await network.provider.send("evm_increaseTime", [AUCTION_DURATION + 1])
                          await network.provider.send("evm_mine", [])
                      }

                      console.log("Testing AuctionEnded event...")
                      const endTx = await qrBid.connect(deployer).endAuction()
                      await expect(endTx).to.emit(qrBid, "AuctionEnded")
                      await endTx.wait(1)

                      console.log("✅ All events emitted correctly")
                  })
              })

              after(async () => {
                  console.log("\n=== STAGING TESTS COMPLETED ===")
                  console.log(`Contract Address: ${await qrBid.getAddress()}`)
                  console.log(`Network: ${network.name}`)

                  const finalAuctionCounter = await qrBid.s_auctionCounter()
                  console.log(`Final Auction Counter: ${finalAuctionCounter}`)

                  const isActive = await qrBid.isAuctionActive()
                  console.log(`Final Active Status: ${isActive}`)
              })
          })
      })
