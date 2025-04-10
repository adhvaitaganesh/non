const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Music Jukebox dApp", function () {
  let owner, artist, listener1, listener2;
  let registry, accountImplementation, mixtapeNFT, socialRegistry, jukebox;
  let mixtapeId, mixtapeTBA;

  const PLAY_PRICE = ethers.parseEther("0.01");

  beforeEach(async function () {
    // Get signers
    [owner, artist, listener1, listener2] = await ethers.getSigners();

    // Deploy contracts
    const Registry = await ethers.getContractFactory("MixtapeRegistry");
    registry = await Registry.deploy();

    const AccountImplementation = await ethers.getContractFactory("MixtapeAccount");
    accountImplementation = await AccountImplementation.deploy();

    const MixtapeNFT = await ethers.getContractFactory("contracts/MixtapeNFT.sol:MixtapeNFT");
    mixtapeNFT = await MixtapeNFT.deploy();

    const SocialRegistry = await ethers.getContractFactory("MixtapeSocialRegistry");
    socialRegistry = await SocialRegistry.deploy();

    // Create a mixtape
    const tx = await mixtapeNFT.connect(owner).createMixtape(
      artist.address,
      "Test Mixtape",
      "A test mixtape for the music jukebox",
      "ipfs://QmTest"
    );
    const receipt = await tx.wait();
    
    // Find the MixtapeCreated event to get the mixtape ID
    const event = receipt.logs.find(log => 
      log.fragment && log.fragment.name === 'MixtapeCreated'
    );
    mixtapeId = event ? event.args.tokenId : 1;
  });

  describe("Mixtape Creation", function () {
    it("Should create a mixtape with correct metadata", async function () {
      // Verify owner
      expect(await mixtapeNFT.ownerOf(mixtapeId)).to.equal(artist.address);
      
      // Verify metadata
      const metadata = await mixtapeNFT.getMixtapeMetadata(mixtapeId);
      expect(metadata.title).to.equal("Test Mixtape");
      expect(metadata.description).to.equal("A test mixtape for the music jukebox");
    });
  });

  describe("Track Management", function () {
    it("Should add tracks to a mixtape", async function () {
      // Add a track
      await mixtapeNFT.connect(artist).addTrack(mixtapeId, "track1");
      
      // Verify track was added
      const metadata = await mixtapeNFT.getMixtapeMetadata(mixtapeId);
      expect(metadata.trackIds.length).to.equal(1);
      expect(metadata.trackIds[0]).to.equal("track1");
    });
  });
});
