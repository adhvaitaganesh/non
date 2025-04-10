// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../contracts/MixtapeRegistry.sol";
import "../contracts/MixtapeAccount.sol";
import "../contracts/EnhancedMixtapeNFT.sol";
import "../contracts/EnhancedMixtapeSocialRegistry.sol";
import "../contracts/MixtapeJukebox.sol";

contract MockERC721Receiver is IERC721Receiver {
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract MixtapeTest {
    // Test accounts
    address public owner;
    address public artist;
    address public listener1;
    address public listener2;
    
    // Contract instances
    MixtapeRegistry public registry;
    MixtapeAccount public accountImplementation;
    EnhancedMixtapeNFT public mixtapeNFT;
    EnhancedMixtapeSocialRegistry public socialRegistry;
    MixtapeJukebox public jukebox;
    
    // Test data
    uint256 public mixtapeId;
    address public mixtapeTBA;
    
    constructor() {
        // Set up test accounts
        owner = msg.sender;
        artist = address(0x1);
        listener1 = address(0x2);
        listener2 = address(0x3);
        
        // Deploy contracts
        registry = new MixtapeRegistry();
        accountImplementation = new MixtapeAccount();
        mixtapeNFT = new EnhancedMixtapeNFT(address(registry), address(accountImplementation));
        socialRegistry = new EnhancedMixtapeSocialRegistry(address(mixtapeNFT));
        jukebox = new MixtapeJukebox(address(mixtapeNFT), address(socialRegistry));
    }
    
    function testCreateMixtape() public {
        // Create a mixtape
        mixtapeId = mixtapeNFT.createMixtape(
            artist,
            "Test Mixtape",
            "A test mixtape for the music jukebox",
            "ipfs://QmTest",
            1 ether
        );
        
        // Verify mixtape was created
        assert(mixtapeNFT.ownerOf(mixtapeId) == artist);
        
        // Get the TBA address
        mixtapeTBA = mixtapeNFT.getTokenBoundAccount(mixtapeId);
        assert(mixtapeTBA != address(0));
        
        // Verify metadata
        (string memory title, string memory description, , ) = mixtapeNFT.getMixtapeMetadata(mixtapeId);
        assert(keccak256(bytes(title)) == keccak256(bytes("Test Mixtape")));
        assert(keccak256(bytes(description)) == keccak256(bytes("A test mixtape for the music jukebox")));
        
        // Verify play price
        assert(mixtapeNFT.getPlayPrice(mixtapeId) == 1 ether);
    }
    
    function testAddTrack() public {
        // Add a track to the mixtape
        mixtapeNFT.addTrack(mixtapeId, "track1");
        
        // Verify track was added
        (, , string[] memory trackIds, ) = mixtapeNFT.getMixtapeMetadata(mixtapeId);
        assert(trackIds.length == 1);
        assert(keccak256(bytes(trackIds[0])) == keccak256(bytes("track1")));
    }
    
    function testPlayMixtape() public payable {
        require(msg.value >= 1 ether, "Insufficient funds for test");
        
        // Get initial balance of TBA
        uint256 initialBalance = address(mixtapeTBA).balance;
        
        // Play the mixtape through the jukebox
        jukebox.playMixtape{value: 1 ether}(mixtapeId);
        
        // Verify play count increased
        assert(jukebox.getPlayCount(mixtapeId) == 1);
        
        // Verify payment was forwarded to TBA (minus platform fee)
        uint256 platformFee = (1 ether * jukebox.platformFeePercentage()) / 10000;
        uint256 expectedPayment = 1 ether - platformFee;
        assert(address(mixtapeTBA).balance == initialBalance + expectedPayment);
        
        // Verify user play history
        uint256[] memory playHistory = jukebox.getUserPlayHistory(msg.sender);
        assert(playHistory.length == 1);
        assert(playHistory[0] == mixtapeId);
    }
    
    function testSocialInteractions() public {
        // Like the mixtape
        socialRegistry.like(mixtapeTBA);
        
        // Verify like was recorded
        assert(socialRegistry.hasLiked(mixtapeTBA, msg.sender) == true);
        assert(socialRegistry.getLikesCount(mixtapeTBA) == 1);
        
        // Add a comment
        socialRegistry.addComment(mixtapeTBA, "Great mixtape!");
        
        // Verify comment was added
        assert(socialRegistry.getCommentsCount(mixtapeTBA) == 1);
        
        // Unlike the mixtape
        socialRegistry.unlike(mixtapeTBA);
        
        // Verify like was removed
        assert(socialRegistry.hasLiked(mixtapeTBA, msg.sender) == false);
        assert(socialRegistry.getLikesCount(mixtapeTBA) == 0);
    }
    
    function testRightsManagement() public {
        // Get the MixtapeAccount interface for the TBA
        IMixtapeAccount account = IMixtapeAccount(mixtapeTBA);
        
        // Verify token information
        (uint256 chainId, address tokenContract, uint256 tokenId) = account.token();
        assert(chainId == block.chainid);
        assert(tokenContract == address(mixtapeNFT));
        assert(tokenId == mixtapeId);
        
        // Verify owner
        assert(account.owner() == artist);
        
        // Set rights data (must be called by the artist)
        bytes memory rightsData = abi.encode("Artist retains all rights");
        bytes memory executeCalldata = abi.encodeWithSignature(
            "setRights(string,bytes)",
            "copyright",
            rightsData
        );
        
        // This would fail if not called by the artist
        // account.execute(mixtapeTBA, 0, executeCalldata);
        
        // In a real test, we would use the artist's private key to sign this transaction
    }
    
    function testWithdrawFees() public {
        // Get initial balance of owner
        uint256 initialBalance = owner.balance;
        
        // Withdraw fees
        jukebox.withdrawFees(payable(owner));
        
        // Verify fees were withdrawn
        assert(address(jukebox).balance == 0);
        assert(owner.balance > initialBalance);
    }
    
    function runAllTests() public payable {
        testCreateMixtape();
        testAddTrack();
        testPlayMixtape();
        testSocialInteractions();
        testRightsManagement();
        testWithdrawFees();
        
        console.log("All tests passed!");
    }
}
