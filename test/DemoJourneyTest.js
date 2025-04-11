const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Music Jukebox dApp - Demo Journey", function () {
    let mixtapeJukebox;
    let mixtapeNFT;
    let socialRegistry;
    let mixtapeAccount;
    let owner;
    let dj;
    let listener1;
    let listener2;
    let listener3;
    let PLAY_PRICE = ethers.parseEther("0.001"); // 0.001 ETH per play

    // Sample stems data
    const stems = [
        {
            id: "stem1",
            name: "Kick Drum",
            artist: "DJ Pro",
            duration: 180, // 3 minutes
            genre: "House",
            bpm: 128,
            key: "A minor"
        },
        {
            id: "stem2",
            name: "Bassline",
            artist: "DJ Pro",
            duration: 180,
            genre: "House",
            bpm: 128,
            key: "A minor"
        },
        {
            id: "stem3",
            name: "Synth Lead",
            artist: "DJ Pro",
            duration: 180,
            genre: "House",
            bpm: 128,
            key: "A minor"
        },
        {
            id: "stem4",
            name: "Vocal Sample",
            artist: "DJ Pro",
            duration: 180,
            genre: "House",
            bpm: 128,
            key: "A minor"
        }
    ];

    // Sample mix data
    const mixData = {
        name: "Summer Vibes 2024",
        description: "A perfect blend of house music for summer nights",
        tokenURI: "ipfs://QmXYZ...123", // Example IPFS URI
        genre: "House",
        bpm: 128,
        key: "A minor",
        duration: 180, // 3 minutes
        playPrice: PLAY_PRICE
    };

    beforeEach(async function () {
        console.log("Starting beforeEach setup...");
        [owner, dj, listener1, listener2, listener3] = await ethers.getSigners();
        console.log("Signers initialized");

        try {
            // Deploy MixtapeAccount implementation
            console.log("Deploying MixtapeAccount...");
            const MixtapeAccount = await ethers.getContractFactory("MixtapeAccount");
            mixtapeAccount = await MixtapeAccount.deploy();
            await mixtapeAccount.waitForDeployment();
            console.log("MixtapeAccount deployed at:", await mixtapeAccount.getAddress());

            // Deploy MixtapeRegistry
            console.log("Deploying MixtapeRegistry...");
            const MixtapeRegistry = await ethers.getContractFactory("MixtapeRegistry");
            const registry = await MixtapeRegistry.deploy();
            await registry.waitForDeployment();
            console.log("MixtapeRegistry deployed at:", await registry.getAddress());

            // Deploy EnhancedMixtapeNFT with registry and implementation
            console.log("Deploying EnhancedMixtapeNFT...");
            console.log("Registry address:", await registry.getAddress());
            console.log("Implementation address:", await mixtapeAccount.getAddress());
            
            const EnhancedMixtapeNFT = await ethers.getContractFactory("EnhancedMixtapeNFT");
            console.log("Contract factory created");
            
            mixtapeNFT = await EnhancedMixtapeNFT.deploy(
                await registry.getAddress(),
                await mixtapeAccount.getAddress()
            );
            console.log("Deployment transaction sent");
            await mixtapeNFT.waitForDeployment();
            console.log("EnhancedMixtapeNFT deployed at:", await mixtapeNFT.getAddress());

            // Deploy EnhancedMixtapeSocialRegistry
            console.log("Deploying EnhancedMixtapeSocialRegistry...");
            const EnhancedMixtapeSocialRegistry = await ethers.getContractFactory("EnhancedMixtapeSocialRegistry");
            socialRegistry = await EnhancedMixtapeSocialRegistry.deploy(await mixtapeNFT.getAddress());
            await socialRegistry.waitForDeployment();
            console.log("EnhancedMixtapeSocialRegistry deployed at:", await socialRegistry.getAddress());

            // Deploy MixtapeJukebox with the addresses of the other contracts
            console.log("Deploying MixtapeJukebox...");
            const MixtapeJukebox = await ethers.getContractFactory("MixtapeJukebox");
            mixtapeJukebox = await MixtapeJukebox.deploy(
                await mixtapeNFT.getAddress(),
                await socialRegistry.getAddress()
            );
            await mixtapeJukebox.waitForDeployment();
            console.log("MixtapeJukebox deployed at:", await mixtapeJukebox.getAddress());
            
            console.log("Setup completed successfully");
        } catch (error) {
            console.error("Error during setup:", error);
            throw error;
        }
    });

    describe("DJ Mix Creation Journey", function () {
        it("should allow DJ to create a mix with stems", async function () {
            // DJ creates a mix using EnhancedMixtapeNFT
            const createMixTx = await mixtapeNFT.connect(dj).createMixtape(
                dj.address,
                mixData.name,
                mixData.description,
                mixData.tokenURI,
                mixData.playPrice
            );

            const mixReceipt = await createMixTx.wait();
            const mixCreatedEvent = mixReceipt.logs.find(log => log.fragment && log.fragment.name === 'MixtapeCreated');
            const mixId = mixCreatedEvent.args[0];

            // Verify mix creation
            const [title, description, trackIds, createdAt] = await mixtapeNFT.getMixtapeMetadata(mixId);
            expect(title).to.equal(mixData.name);
            expect(description).to.equal(mixData.description);
            expect(await mixtapeNFT.getCreator(mixId)).to.equal(dj.address);
            expect(await mixtapeNFT.getPlayPrice(mixId)).to.equal(mixData.playPrice);

            // Verify TBA was created
            const tbaAddress = await mixtapeNFT.getTokenBoundAccount(mixId);
            expect(tbaAddress).to.not.equal(ethers.ZeroAddress);

            // DJ adds stems to the mix
            for (const stem of stems) {
                const addStemTx = await mixtapeNFT.connect(dj).addTrack(
                    mixId,
                    stem.id
                );
                await addStemTx.wait();
            }

            // Verify stems were added
            const [_, __, updatedTrackIds, ___] = await mixtapeNFT.getMixtapeMetadata(mixId);
            expect(updatedTrackIds.length).to.equal(stems.length);
            expect(updatedTrackIds[0]).to.equal(stems[0].id);
            expect(updatedTrackIds[1]).to.equal(stems[1].id);
        });

        it("should prevent non-owners from adding stems", async function () {
            // DJ creates a mix
            const createMixTx = await mixtapeNFT.connect(dj).createMixtape(
                dj.address,
                mixData.name,
                mixData.description,
                mixData.tokenURI,
                mixData.playPrice
            );

            const mixReceipt = await createMixTx.wait();
            const mixCreatedEvent = mixReceipt.logs.find(log => log.fragment && log.fragment.name === 'MixtapeCreated');
            const mixId = mixCreatedEvent.args[0];

            // Try to add stem as a non-owner
            await expect(
                mixtapeNFT.connect(listener1).addTrack(mixId, stems[0].id)
            ).to.be.revertedWith("MixtapeNFT: Caller is not owner nor approved");
        });
    });

    describe("Listener Interaction Journey", function () {
        let mixId;

        beforeEach(async function () {
            // Create a mix first using EnhancedMixtapeNFT
            const createMixTx = await mixtapeNFT.connect(dj).createMixtape(
                dj.address,
                mixData.name,
                mixData.description,
                mixData.tokenURI,
                mixData.playPrice
            );

            const mixReceipt = await createMixTx.wait();
            const mixCreatedEvent = mixReceipt.logs.find(log => log.fragment && log.fragment.name === 'MixtapeCreated');
            mixId = mixCreatedEvent.args[0];

            // Add stems
            for (const stem of stems) {
                await mixtapeNFT.connect(dj).addTrack(
                    mixId,
                    stem.id
                );
            }
        });

        it("should allow listeners to play, like, and comment on the mix", async function () {
            // Get the TBA address
            const tbaAddress = await mixtapeNFT.getTokenBoundAccount(mixId);

            // Listener 1 plays the mix
            const playTx1 = await mixtapeJukebox.connect(listener1).playMixtape(mixId, { value: PLAY_PRICE });
            await playTx1.wait();

            // Listener 1 likes the mix using SocialRegistry
            const likeTx1 = await socialRegistry.connect(listener1).like(tbaAddress);
            await likeTx1.wait();

            // Listener 1 comments on the mix using SocialRegistry
            const commentTx1 = await socialRegistry.connect(listener1).addComment(tbaAddress, "Amazing mix! Love the bassline!");
            await commentTx1.wait();

            // Listener 2 plays and likes the mix
            const playTx2 = await mixtapeJukebox.connect(listener2).playMixtape(mixId, { value: PLAY_PRICE });
            await playTx2.wait();
            const likeTx2 = await socialRegistry.connect(listener2).like(tbaAddress);
            await likeTx2.wait();

            // Listener 3 plays the mix
            const playTx3 = await mixtapeJukebox.connect(listener3).playMixtape(mixId, { value: PLAY_PRICE });
            await playTx3.wait();

            // Verify mix statistics
            const playCount = await mixtapeJukebox.getPlayCount(mixId);
            const likeCount = await socialRegistry.getLikesCount(tbaAddress);
            const comments = await socialRegistry.getComments(tbaAddress);
            expect(playCount).to.equal(3);
            expect(likeCount).to.equal(2);

            // Verify comments
            expect(comments.length).to.equal(1);
            expect(comments[0].text).to.equal("Amazing mix! Love the bassline!");
            expect(comments[0].author).to.equal(listener1.address);

            // Verify revenue distribution
            const tbaBalance = await ethers.provider.getBalance(tbaAddress);
            const platformFeePercentage = 250; // 2.5%
            const platformFee = (PLAY_PRICE * BigInt(platformFeePercentage)) / BigInt(10000);
            const artistPayment = PLAY_PRICE - platformFee;
            const expectedRevenue = artistPayment * BigInt(3); // 3 plays
            expect(tbaBalance).to.equal(expectedRevenue);
        });

        it("should handle multiple interactions from the same listener", async function () {
            // Get the TBA address
            const tbaAddress = await mixtapeNFT.getTokenBoundAccount(mixId);

            // Listener 1 plays multiple times
            for (let i = 0; i < 3; i++) {
                const playTx = await mixtapeJukebox.connect(listener1).playMixtape(mixId, { value: PLAY_PRICE });
                await playTx.wait();
            }

            // Listener 1 likes and unlikes using SocialRegistry
            const likeTx = await socialRegistry.connect(listener1).like(tbaAddress);
            await likeTx.wait();
            const unlikeTx = await socialRegistry.connect(listener1).unlike(tbaAddress);
            await unlikeTx.wait();

            // Listener 1 adds multiple comments using SocialRegistry
            const comment1Tx = await socialRegistry.connect(listener1).addComment(tbaAddress, "First comment");
            await comment1Tx.wait();
            const comment2Tx = await socialRegistry.connect(listener1).addComment(tbaAddress, "Second comment");
            await comment2Tx.wait();

            // Verify statistics
            const playCount = await mixtapeJukebox.getPlayCount(mixId);
            const likeCount = await socialRegistry.getLikesCount(tbaAddress);
            const comments = await socialRegistry.getComments(tbaAddress);
            expect(playCount).to.equal(3);
            expect(likeCount).to.equal(0); // Unliked

            // Verify comments
            expect(comments.length).to.equal(2);
            expect(comments[0].text).to.equal("First comment");
            expect(comments[1].text).to.equal("Second comment");

            // Verify revenue
            const tbaBalance = await ethers.provider.getBalance(tbaAddress);
            const platformFeePercentage = 250; // 2.5%
            const platformFee = (PLAY_PRICE * BigInt(platformFeePercentage)) / BigInt(10000);
            const artistPayment = PLAY_PRICE - platformFee;
            const expectedRevenue = artistPayment * BigInt(3); // 3 plays
            expect(tbaBalance).to.equal(expectedRevenue);
        });

        it("should prevent playing with incorrect payment amount", async function () {
            const incorrectPrice = ethers.parseEther("0.0005"); // Half the required price
            await expect(
                mixtapeJukebox.connect(listener1).playMixtape(mixId, { value: incorrectPrice })
            ).to.be.revertedWith("MixtapeJukebox: Insufficient payment");
        });

        it("should prevent playing non-existent mixtapes", async function () {
            const nonExistentMixId = 999;
            await expect(
                mixtapeJukebox.connect(listener1).playMixtape(nonExistentMixId, { value: PLAY_PRICE })
            ).to.be.revertedWith("MixtapeJukebox: Failed to get play price");
        });
    });

    describe("Mix Analytics Journey", function () {
        let mixId;

        beforeEach(async function () {
            // Create a mix using EnhancedMixtapeNFT
            const createMixTx = await mixtapeNFT.connect(dj).createMixtape(
                dj.address,
                mixData.name,
                mixData.description,
                mixData.tokenURI,
                mixData.playPrice
            );

            const mixReceipt = await createMixTx.wait();
            const mixCreatedEvent = mixReceipt.logs.find(log => log.fragment && log.fragment.name === 'MixtapeCreated');
            mixId = mixCreatedEvent.args[0];

            // Add stems
            for (const stem of stems) {
                await mixtapeNFT.connect(dj).addTrack(
                    mixId,
                    stem.id
                );
            }
        });

        it("should track and display mix analytics", async function () {
            // Get the TBA address
            const tbaAddress = await mixtapeNFT.getTokenBoundAccount(mixId);

            // Simulate multiple plays from different listeners
            const listeners = [listener1, listener2, listener3];
            for (let i = 0; i < 10; i++) {
                const listener = listeners[i % listeners.length];
                const playTx = await mixtapeJukebox.connect(listener).playMixtape(mixId, { value: PLAY_PRICE });
                await playTx.wait();
            }

            // Simulate likes using SocialRegistry
            for (const listener of listeners) {
                const likeTx = await socialRegistry.connect(listener).like(tbaAddress);
                await likeTx.wait();
            }

            // Simulate comments using SocialRegistry
            const comments = [
                "Great mix!",
                "Love the bassline!",
                "Perfect for summer!"
            ];
            for (let i = 0; i < comments.length; i++) {
                const commentTx = await socialRegistry.connect(listeners[i]).addComment(tbaAddress, comments[i]);
                await commentTx.wait();
            }

            // Verify analytics
            const playCount = await mixtapeJukebox.getPlayCount(mixId);
            const likeCount = await socialRegistry.getLikesCount(tbaAddress);
            const mixComments = await socialRegistry.getComments(tbaAddress);
            expect(playCount).to.equal(10);
            expect(likeCount).to.equal(3);

            // Verify revenue
            const tbaBalance = await ethers.provider.getBalance(tbaAddress);
            const platformFeePercentage = 250; // 2.5%
            const platformFee = (PLAY_PRICE * BigInt(platformFeePercentage)) / BigInt(10000);
            const artistPayment = PLAY_PRICE - platformFee;
            const expectedRevenue = artistPayment * BigInt(10); // 10 plays
            expect(tbaBalance).to.equal(expectedRevenue);

            // Verify stems
            const [_, __, trackIds, ___] = await mixtapeNFT.getMixtapeMetadata(mixId);
            expect(trackIds.length).to.equal(stems.length);

            // Verify comments
            expect(mixComments.length).to.equal(3);
            expect(mixComments[0].text).to.equal(comments[0]);
            expect(mixComments[1].text).to.equal(comments[1]);
            expect(mixComments[2].text).to.equal(comments[2]);
        });
    });
}); 