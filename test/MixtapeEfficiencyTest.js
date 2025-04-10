const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZeroAddress } = ethers;

describe("Mixtape dApp Efficiency Tests", function () {
  // Test configuration
  const NUM_ARTISTS = 5;
  const NUM_LISTENERS = 10;
  const TRACKS_PER_MIXTAPE = 20;
  const PLAYS_PER_MIXTAPE = 50;
  const COMMENTS_PER_MIXTAPE = 30;
  const LIKES_PER_MIXTAPE = 100;

  // Contract instances
  let owner;
  let artists = [];
  let listeners = [];
  let registry, accountImplementation, mixtapeNFT, socialRegistry, jukebox;

  // Test data
  const PLAY_PRICE = ethers.parseEther("0.01");
  const DEFAULT_PLATFORM_FEE_PERCENTAGE = 250; // 2.5%

  // Helper function to create mixtape with performance tracking
  async function createMixtapeWithMetrics(creator, title, description, price = PLAY_PRICE) {
    const startTime = Date.now();
    const tx = await mixtapeNFT.connect(creator).createMixtape(
      creator.address,
      title,
      description,
      "ipfs://QmTest",
      price
    );
    
    const receipt = await tx.wait();
    const endTime = Date.now();
    
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
    
    return {
      mixtapeId,
      mixtapeTBA,
      gasUsed: receipt.gasUsed,
      executionTime: endTime - startTime
    };
  }

  // Helper function to add tracks with performance tracking
  async function addTracksWithMetrics(mixtapeId, artist, numTracks) {
    const startTime = Date.now();
    const gasUsed = [];
    
    for (let i = 1; i <= numTracks; i++) {
      const tx = await mixtapeNFT.connect(artist).addTrack(mixtapeId, `track${i}`);
      const receipt = await tx.wait();
      gasUsed.push(Number(receipt.gasUsed));
    }
    
    const endTime = Date.now();
    return {
      gasUsed,
      executionTime: endTime - startTime,
      averageGasPerTrack: gasUsed.reduce((a, b) => a + b, 0) / numTracks
    };
  }

  beforeEach(async function () {
    // Get signers
    [owner, ...rest] = await ethers.getSigners();
    artists = rest.slice(0, NUM_ARTISTS);
    listeners = rest.slice(NUM_ARTISTS, NUM_ARTISTS + NUM_LISTENERS);

    // Deploy contracts
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

  describe("Gas Efficiency Metrics", function () {
    it("Should measure gas costs for mixtape creation", async function () {
      const metrics = [];
      
      for (let i = 0; i < NUM_ARTISTS; i++) {
        const result = await createMixtapeWithMetrics(
          artists[i],
          `Mixtape ${i}`,
          `Description for mixtape ${i}`
        );
        metrics.push(result);
      }
      
      const averageGas = metrics.reduce((sum, m) => sum + Number(m.gasUsed), 0) / NUM_ARTISTS;
      const averageTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / NUM_ARTISTS;
      
      console.log("\nMixtape Creation Metrics:");
      console.log(`Average Gas Used: ${averageGas}`);
      console.log(`Average Execution Time: ${averageTime}ms`);
      
      // Store metrics for later comparison
      this.mixtapeCreationMetrics = metrics;
    });

    it("Should measure gas costs for track addition", async function () {
      const { mixtapeId } = await createMixtapeWithMetrics(artists[0], "Test Mixtape", "Test Description");
      
      const metrics = await addTracksWithMetrics(mixtapeId, artists[0], TRACKS_PER_MIXTAPE);
      
      console.log("\nTrack Addition Metrics:");
      console.log(`Total Gas Used: ${metrics.gasUsed.reduce((a, b) => a + b, 0)}`);
      console.log(`Average Gas Per Track: ${metrics.averageGasPerTrack}`);
      console.log(`Total Execution Time: ${metrics.executionTime}ms`);
      
      // Store metrics for later comparison
      this.trackAdditionMetrics = metrics;
    });

    it("Should measure gas costs for multiple plays", async function () {
      const { mixtapeId, mixtapeTBA } = await createMixtapeWithMetrics(artists[0], "Test Mixtape", "Test Description");
      const gasUsed = [];
      const startTime = Date.now();
      
      for (let i = 0; i < PLAYS_PER_MIXTAPE; i++) {
        const listener = listeners[i % NUM_LISTENERS];
        const tx = await jukebox.connect(listener).playMixtape(mixtapeId, { value: PLAY_PRICE });
        const receipt = await tx.wait();
        gasUsed.push(Number(receipt.gasUsed));
      }
      
      const endTime = Date.now();
      const averageGas = gasUsed.reduce((a, b) => a + b, 0) / PLAYS_PER_MIXTAPE;
      
      console.log("\nPlay Operation Metrics:");
      console.log(`Average Gas Per Play: ${averageGas}`);
      console.log(`Total Execution Time: ${endTime - startTime}ms`);
      
      // Store metrics for later comparison
      this.playMetrics = { gasUsed, averageGas, executionTime: endTime - startTime };
    });

    it("Should measure gas costs for social interactions", async function () {
      const { mixtapeTBA } = await createMixtapeWithMetrics(artists[0], "Test Mixtape", "Test Description");
      const metrics = {
        likes: { gasUsed: [], startTime: Date.now() },
        comments: { gasUsed: [], startTime: Date.now() }
      };
      
      // Test likes - ensure each user only likes once
      const uniqueListeners = listeners.slice(0, LIKES_PER_MIXTAPE);
      for (let i = 0; i < uniqueListeners.length; i++) {
        const listener = uniqueListeners[i];
        const tx = await socialRegistry.connect(listener).like(mixtapeTBA);
        const receipt = await tx.wait();
        metrics.likes.gasUsed.push(Number(receipt.gasUsed));
      }
      metrics.likes.endTime = Date.now();
      
      // Test comments
      for (let i = 0; i < COMMENTS_PER_MIXTAPE; i++) {
        const listener = listeners[i % NUM_LISTENERS];
        const tx = await socialRegistry.connect(listener).addComment(mixtapeTBA, `Comment ${i}`);
        const receipt = await tx.wait();
        metrics.comments.gasUsed.push(Number(receipt.gasUsed));
      }
      metrics.comments.endTime = Date.now();
      
      // Calculate averages
      metrics.likes.averageGas = metrics.likes.gasUsed.reduce((a, b) => a + b, 0) / metrics.likes.gasUsed.length;
      metrics.comments.averageGas = metrics.comments.gasUsed.reduce((a, b) => a + b, 0) / COMMENTS_PER_MIXTAPE;
      
      console.log("\nSocial Interaction Metrics:");
      console.log(`Average Gas Per Like: ${metrics.likes.averageGas}`);
      console.log(`Average Gas Per Comment: ${metrics.comments.averageGas}`);
      console.log(`Total Likes Execution Time: ${metrics.likes.endTime - metrics.likes.startTime}ms`);
      console.log(`Total Comments Execution Time: ${metrics.comments.endTime - metrics.comments.startTime}ms`);
      
      // Store metrics for later comparison
      this.socialMetrics = metrics;
    });

    it("Should measure gas costs for batch operations", async function () {
      const startTime = Date.now();
      const batchMetrics = [];
      
      // Create multiple mixtapes with tracks
      for (let i = 0; i < NUM_ARTISTS; i++) {
        const artist = artists[i];
        const { mixtapeId, gasUsed: creationGas } = await createMixtapeWithMetrics(
          artist,
          `Batch Mixtape ${i}`,
          `Batch test mixtape ${i}`
        );
        
        const { gasUsed: trackGas, executionTime: trackTime } = await addTracksWithMetrics(
          mixtapeId,
          artist,
          TRACKS_PER_MIXTAPE
        );
        
        batchMetrics.push({
          creationGas: Number(creationGas),
          trackGas,
          trackTime
        });
      }
      
      const endTime = Date.now();
      
      // Calculate averages
      const averageCreationGas = batchMetrics.reduce((sum, m) => sum + m.creationGas, 0) / NUM_ARTISTS;
      const averageTrackGas = batchMetrics.reduce((sum, m) => 
        sum + m.trackGas.reduce((a, b) => a + b, 0) / TRACKS_PER_MIXTAPE, 0) / NUM_ARTISTS;
      
      console.log("\nBatch Operation Metrics:");
      console.log(`Average Creation Gas: ${averageCreationGas}`);
      console.log(`Average Track Addition Gas: ${averageTrackGas}`);
      console.log(`Total Batch Execution Time: ${endTime - startTime}ms`);
      
      // Store metrics for later comparison
      this.batchMetrics = {
        averageCreationGas,
        averageTrackGas,
        executionTime: endTime - startTime
      };
    });

    after(function () {
      if (!this.mixtapeCreationMetrics || !this.trackAdditionMetrics || 
          !this.playMetrics || !this.socialMetrics || !this.batchMetrics) {
        console.log("\nSome metrics are missing. Skipping final report.");
        return;
      }

      // Generate final efficiency report
      console.log("\n=== Final Efficiency Report ===");
      console.log("Mixtape Creation:");
      console.log(`- Average Gas: ${this.mixtapeCreationMetrics.reduce((sum, m) => sum + Number(m.gasUsed), 0) / NUM_ARTISTS}`);
      
      console.log("\nTrack Management:");
      console.log(`- Average Gas Per Track: ${this.trackAdditionMetrics.averageGasPerTrack}`);
      
      console.log("\nPlay Operations:");
      console.log(`- Average Gas Per Play: ${this.playMetrics.averageGas}`);
      
      console.log("\nSocial Interactions:");
      console.log(`- Average Gas Per Like: ${this.socialMetrics.likes.averageGas}`);
      console.log(`- Average Gas Per Comment: ${this.socialMetrics.comments.averageGas}`);
      
      console.log("\nBatch Operations:");
      console.log(`- Average Creation Gas: ${this.batchMetrics.averageCreationGas}`);
      console.log(`- Average Track Addition Gas: ${this.batchMetrics.averageTrackGas}`);
    });
  });
}); 