const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZeroAddress } = ethers;

describe("Music Jukebox dApp", function () {
  let owner, artist, listener1, listener2;
  let registry, accountImplementation, mixtapeNFT, socialRegistry, jukebox;

  const PLAY_PRICE = ethers.parseEther("0.01");
  const DEFAULT_PLATFORM_FEE_PERCENTAGE = 250; // 2.5%

  async function createMixtape() {
    const tx = await mixtapeNFT.connect(artist).createMixtape(
      artist.address,
      "Test Mixtape",
      "A test mixtape for the music jukebox",
      "ipfs://QmTest",
      PLAY_PRICE
    );
    
    const receipt = await tx.wait();
    
    // Find the MixtapeCreated event to get the mixtape ID
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
    // Get signers
    [owner, artist, listener1, listener2] = await ethers.getSigners();

    // Deploy contracts in the correct order
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

  describe("Mixtape Creation", function () {
    it("Should create a mixtape with correct metadata", async function () {
      const { mixtapeId, mixtapeTBA } = await createMixtape();
      expect(await mixtapeNFT.ownerOf(mixtapeId)).to.equal(artist.address);
      expect(await mixtapeNFT.tokenURI(mixtapeId)).to.equal("ipfs://QmTest");
      expect(mixtapeTBA).to.not.equal(ZeroAddress);
      expect(await mixtapeNFT.getPlayPrice(mixtapeId)).to.equal(PLAY_PRICE);
    });
  });

  describe("Track Management", function () {
    it("Should add tracks to a mixtape", async function () {
      const { mixtapeId } = await createMixtape();
      await mixtapeNFT.connect(artist).addTrack(mixtapeId, "track1");
      await mixtapeNFT.connect(artist).addTrack(mixtapeId, "track2");
      const metadata = await mixtapeNFT.getMixtapeMetadata(mixtapeId);
      expect(metadata.trackIds.length).to.equal(2);
      expect(metadata.trackIds[0]).to.equal("track1");
      expect(metadata.trackIds[1]).to.equal("track2");
    });

    it("Should prevent non-owners from adding tracks", async function () {
      const { mixtapeId } = await createMixtape();
      await expect(
        mixtapeNFT.connect(listener1).addTrack(mixtapeId, "track3")
      ).to.be.revertedWith("MixtapeNFT: Caller is not owner nor approved");
    });
  });

  describe("Play Mechanism", function () {
    it("Should allow playing a mixtape through the jukebox", async function () {
      const { mixtapeId, mixtapeTBA } = await createMixtape();
      const initialBalance = await ethers.provider.getBalance(mixtapeTBA);
      await jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE });
      const finalBalance = await ethers.provider.getBalance(mixtapeTBA);
      const platformFee = PLAY_PRICE * BigInt(DEFAULT_PLATFORM_FEE_PERCENTAGE) / BigInt(10000); // 2.5% platform fee
      expect(finalBalance - initialBalance).to.equal(PLAY_PRICE - platformFee);
    });

    it("Should reject insufficient payment", async function () {
      const { mixtapeId } = await createMixtape();
      const insufficientPrice = PLAY_PRICE / 2n;
      await expect(
        jukebox.connect(listener1).playMixtape(mixtapeId, { value: insufficientPrice })
      ).to.be.revertedWith("MixtapeJukebox: Insufficient payment");
    });
  });

  describe("Social Interactions", function () {
    it("Should allow liking and unliking mixtapes", async function () {
      const { mixtapeTBA } = await createMixtape();
      console.log("TBA Address:", mixtapeTBA);
      console.log("Social Registry MixtapeNFT:", await socialRegistry.mixtapeNFT());

      await socialRegistry.connect(listener1).like(mixtapeTBA);
      expect(await socialRegistry.hasLiked(mixtapeTBA, listener1.address)).to.be.true;
      expect(await socialRegistry.getLikesCount(mixtapeTBA)).to.equal(1);

      await socialRegistry.connect(listener1).unlike(mixtapeTBA);
      expect(await socialRegistry.hasLiked(mixtapeTBA, listener1.address)).to.be.false;
      expect(await socialRegistry.getLikesCount(mixtapeTBA)).to.equal(0);
    });

    it("Should allow adding comments", async function () {
      const { mixtapeTBA } = await createMixtape();
      console.log("TBA Address:", mixtapeTBA);
      console.log("Social Registry MixtapeNFT:", await socialRegistry.mixtapeNFT());

      await socialRegistry.connect(listener1).addComment(mixtapeTBA, "Great mixtape!");
      const comments = await socialRegistry.getComments(mixtapeTBA);
      expect(comments.length).to.equal(1);
      expect(comments[0].author).to.equal(listener1.address);
      expect(comments[0].text).to.equal("Great mixtape!");
    });
  });

  describe("Platform Management", function () {
    it("Should allow withdrawing platform fees", async function () {
      const { mixtapeId } = await createMixtape();
      const platformFee = PLAY_PRICE * BigInt(DEFAULT_PLATFORM_FEE_PERCENTAGE) / BigInt(10000); // 2.5% platform fee
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      // Play the mixtape to generate fees
      await jukebox.connect(listener1).playMixtape(mixtapeId, { value: PLAY_PRICE });
      
      // Withdraw fees
      const tx = await jukebox.connect(owner).withdrawFees(owner.address);
      const receipt = await tx.wait();
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      expect(finalBalance + gasCost - initialBalance).to.equal(platformFee);
    });

    it("Should allow updating platform fee percentage", async function () {
      const newFeePercentage = 10;
      await jukebox.connect(owner).setPlatformFeePercentage(newFeePercentage);
      expect(await jukebox.platformFeePercentage()).to.equal(newFeePercentage);
    });
  });
});
