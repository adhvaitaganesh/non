const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZeroAddress } = ethers;

describe("Enhanced Music Jukebox dApp", function () {
  let owner, artist, listener1, listener2, unauthorizedUser;
  let registry, accountImplementation, mixtapeNFT, socialRegistry, jukebox;

  const PLAY_PRICE = ethers.parseEther("0.01");
  const DEFAULT_PLATFORM_FEE_PERCENTAGE = 250; // 2.5%
  const MAX_TRACKS = 20;
  const MAX_COMMENT_LENGTH = 280;

  async function createMixtape(creator, title = "Test Mixtape", description = "A test mixtape", price = PLAY_PRICE) {
    const tx = await mixtapeNFT.connect(creator).createMixtape(
      creator.address,
      title,
      description,
      "ipfs://QmTest",
      price
    );
    
    const receipt = await tx.wait();
    
    const event = receipt.logs.find(log => {
      try {
        const parsedLog = mixtapeNFT.interface.parseLog(log);
        return parsedLog && parsedLog.name === "MixtapeCreated";
      } catch (e) {
        return false;
      }
    });
    
    if (!event) {
      throw new Error("MixtapeCreated event not found in transaction receipt");
    }
    
    const parsedEvent = mixtapeNFT.interface.parseLog(event);
    const mixtapeId = parsedEvent.args.tokenId;
    const mixtapeTBA = await mixtapeNFT.getTokenBoundAccount(mixtapeId);
    
    return { mixtapeId, mixtapeTBA };
  }

  beforeEach(async function () {
    [owner, artist, listener1, listener2, unauthorizedUser] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MixtapeRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    const AccountImplementation = await ethers.getContractFactory("MixtapeAccount");
    accountImplementation = await AccountImplementation.deploy();
    await accountImplementation.waitForDeployment();

    const MixtapeNFT = await ethers.getContractFactory("EnhancedMixtapeNFT");
    mixtapeNFT = await MixtapeNFT.deploy(await registry.getAddress(), await accountImplementation.getAddress());
    await mixtapeNFT.waitForDeployment();

    const SocialRegistry = await ethers.getContractFactory("EnhancedMixtapeSocialRegistry");
    socialRegistry = await SocialRegistry.deploy(await mixtapeNFT.getAddress());
    await socialRegistry.waitForDeployment();

    const Jukebox = await ethers.getContractFactory("MixtapeJukebox");
    jukebox = await Jukebox.deploy(await mixtapeNFT.getAddress(), await socialRegistry.getAddress());
    await jukebox.waitForDeployment();
  });

  describe("Mixtape Creation and Ownership", function () {
    it("Should create a mixtape with correct initial state", async function () {
      const { mixtapeId, mixtapeTBA } = await createMixtape(artist);
      
      // Verify ownership
      expect(await mixtapeNFT.ownerOf(mixtapeId)).to.equal(artist.address);
      expect(await mixtapeNFT.getCreator(mixtapeId)).to.equal(artist.address);
      
      // Verify metadata
      const metadata = await mixtapeNFT.getMixtapeMetadata(mixtapeId);
      expect(metadata.title).to.equal("Test Mixtape");
      expect(metadata.description).to.equal("A test mixtape");
      expect(metadata.trackIds.length).to.equal(0);
      expect(metadata.createdAt).to.be.gt(0);
      
      // Verify TBA
      expect(mixtapeTBA).to.not.equal(ZeroAddress);
      expect(await mixtapeNFT.getTokenBoundAccount(mixtapeId)).to.equal(mixtapeTBA);
      
      // Verify play price
      expect(await mixtapeNFT.getPlayPrice(mixtapeId)).to.equal(PLAY_PRICE);
    });

    it("Should allow setting custom play price", async function () {
      const customPrice = ethers.parseEther("0.05");
      const { mixtapeId } = await createMixtape(artist, "Custom Price Mixtape", "A mixtape with custom price", customPrice);
      
      expect(await mixtapeNFT.getPlayPrice(mixtapeId)).to.equal(customPrice);
    });

    it("Should prevent unauthorized users from creating mixtapes", async function () {
      await expect(
        mixtapeNFT.connect(unauthorizedUser).createMixtape(
          unauthorizedUser.address,
          "Unauthorized Mixtape",
          "Should not be created",
          "ipfs://QmTest",
          PLAY_PRICE
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow transferring ownership of mixtape", async function () {
      const { mixtapeId } = await createMixtape(artist);
      
      // Transfer ownership
      await mixtapeNFT.connect(artist).transferFrom(artist.address, listener1.address, mixtapeId);
      
      // Verify new ownership
      expect(await mixtapeNFT.ownerOf(mixtapeId)).to.equal(listener1.address);
      // Creator should remain the same
      expect(await mixtapeNFT.getCreator(mixtapeId)).to.equal(artist.address);
    });
  });

  describe("Track Management", function () {
    it("Should allow adding multiple tracks to a mixtape", async function () {
      const { mixtapeId } = await createMixtape(artist);
      
      // Add multiple tracks
      for (let i = 1; i <= 5; i++) {
        await mixtapeNFT.connect(artist).addTrack(mixtapeId, `track${i}`);
      }
      
      const metadata = await mixtapeNFT.getMixtapeMetadata(mixtapeId);
      expect(metadata.trackIds.length).to.equal(5);
      
      // Verify track order
      for (let i = 0; i < 5; i++) {
        expect(metadata.trackIds[i]).to.equal(`track${i + 1}`);
      }
    });

    it("Should prevent adding tracks to non-existent mixtapes", async function () {
      await expect(
        mixtapeNFT.connect(artist).addTrack(999, "track1")
      ).to.be.revertedWith("MixtapeNFT: Token does not exist");
    });

    it("Should prevent non-owners from adding tracks", async function () {
      const { mixtapeId } = await createMixtape(artist);
      
      await expect(
        mixtapeNFT.connect(listener1).addTrack(mixtapeId, "unauthorized_track")
      ).to.be.revertedWith("MixtapeNFT: Caller is not owner nor approved");
    });
  });

  describe("Play Mechanism", function () {
    it("Should handle multiple plays correctly", async function () {
      const { mixtapeId, mixtapeTBA } = await createMixtape(artist);
      const initialBalance = await ethers.provider.getBalance(mixtapeTBA);
      
      // Multiple listeners play the mixtape
      await jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE });
      await jukebox.connect(listener2).playMixtape(mixtapeId, { value: PLAY_PRICE });
      
      const finalBalance = await ethers.provider.getBalance(mixtapeTBA);
      const platformFee = PLAY_PRICE * BigInt(DEFAULT_PLATFORM_FEE_PERCENTAGE) / BigInt(10000);
      const expectedBalance = initialBalance + (PLAY_PRICE - platformFee) * 2n;
      
      expect(finalBalance).to.equal(expectedBalance);
    });

    it("Should reject plays with incorrect payment amount", async function () {
      const { mixtapeId } = await createMixtape(artist);
      
      // Test with insufficient payment
      await expect(
        jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE / 2n })
      ).to.be.revertedWith("MixtapeJukebox: Insufficient payment");
      
      // Test with excessive payment
      await expect(
        jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE * 2n })
      ).to.be.revertedWith("MixtapeJukebox: Insufficient payment");
    });

    it("Should prevent playing non-existent mixtapes", async function () {
      await expect(
        jukebox.connect(listener1).playMixtape(999, { value: PLAY_PRICE })
      ).to.be.revertedWith("MixtapeNFT: Token does not exist");
    });
  });

  describe("Social Interactions", function () {
    it("Should handle multiple likes and unlikes correctly", async function () {
      const { mixtapeTBA } = await createMixtape(artist);
      
      // Multiple users like the mixtape
      await socialRegistry.connect(listener1).like(mixtapeTBA);
      await socialRegistry.connect(listener2).like(mixtapeTBA);
      
      expect(await socialRegistry.getLikesCount(mixtapeTBA)).to.equal(2);
      expect(await socialRegistry.hasLiked(mixtapeTBA, listener1.address)).to.be.true;
      expect(await socialRegistry.hasLiked(mixtapeTBA, listener2.address)).to.be.true;
      
      // One user unlikes
      await socialRegistry.connect(listener1).unlike(mixtapeTBA);
      
      expect(await socialRegistry.getLikesCount(mixtapeTBA)).to.equal(1);
      expect(await socialRegistry.hasLiked(mixtapeTBA, listener1.address)).to.be.false;
      expect(await socialRegistry.hasLiked(mixtapeTBA, listener2.address)).to.be.true;
    });

    it("Should handle multiple comments correctly", async function () {
      const { mixtapeTBA } = await createMixtape(artist);
      
      // Add multiple comments
      const comments = [
        "Great mixtape!",
        "Love the tracks!",
        "Amazing work!"
      ];
      
      for (const comment of comments) {
        await socialRegistry.connect(listener1).addComment(mixtapeTBA, comment);
      }
      
      const storedComments = await socialRegistry.getComments(mixtapeTBA);
      expect(storedComments.length).to.equal(comments.length);
      
      // Verify comment content and order
      for (let i = 0; i < comments.length; i++) {
        expect(storedComments[i].author).to.equal(listener1.address);
        expect(storedComments[i].text).to.equal(comments[i]);
        expect(storedComments[i].timestamp).to.be.gt(0);
      }
    });

    it("Should prevent invalid social interactions", async function () {
      const { mixtapeTBA } = await createMixtape(artist);
      
      // Try to like with invalid TBA
      await expect(
        socialRegistry.connect(listener1).like(ZeroAddress)
      ).to.be.revertedWith("MixtapeSocialRegistry: Invalid mixtape address");
      
      // Try to unlike without having liked
      await expect(
        socialRegistry.connect(listener1).unlike(mixtapeTBA)
      ).to.be.revertedWith("MixtapeSocialRegistry: Not liked yet");
      
      // Try to add empty comment
      await expect(
        socialRegistry.connect(listener1).addComment(mixtapeTBA, "")
      ).to.be.revertedWith("MixtapeSocialRegistry: Empty comment");
      
      // Try to add comment that's too long
      const longComment = "a".repeat(MAX_COMMENT_LENGTH + 1);
      await expect(
        socialRegistry.connect(listener1).addComment(mixtapeTBA, longComment)
      ).to.be.revertedWith("MixtapeSocialRegistry: Comment too long");
    });
  });

  describe("Platform Management", function () {
    it("Should handle platform fee withdrawals correctly", async function () {
      const { mixtapeId } = await createMixtape(artist);
      const platformFee = PLAY_PRICE * BigInt(DEFAULT_PLATFORM_FEE_PERCENTAGE) / BigInt(10000);
      
      // Generate fees through multiple plays
      await jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE });
      await jukebox.connect(listener2).playMixtape(mixtapeId, { value: PLAY_PRICE });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      // Withdraw fees
      const tx = await jukebox.connect(owner).withdrawFees(owner.address);
      const receipt = await tx.wait();
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      expect(finalBalance + gasCost - initialBalance).to.equal(platformFee * 2n);
    });

    it("Should allow updating platform fee percentage", async function () {
      const newFeePercentage = 500; // 5%
      await jukebox.connect(owner).setPlatformFeePercentage(newFeePercentage);
      expect(await jukebox.platformFeePercentage()).to.equal(newFeePercentage);
      
      // Verify new fee calculation
      const { mixtapeId, mixtapeTBA } = await createMixtape(artist);
      const initialBalance = await ethers.provider.getBalance(mixtapeTBA);
      
      await jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE });
      
      const finalBalance = await ethers.provider.getBalance(mixtapeTBA);
      const newPlatformFee = PLAY_PRICE * BigInt(newFeePercentage) / BigInt(10000);
      expect(finalBalance - initialBalance).to.equal(PLAY_PRICE - newPlatformFee);
    });

    it("Should prevent unauthorized fee updates", async function () {
      await expect(
        jukebox.connect(unauthorizedUser).setPlatformFeePercentage(100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 