// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnhancedMixtapeNFT
 * @dev Enhanced ERC721 token representing mixtapes that can have token bound accounts
 */
contract EnhancedMixtapeNFT is ERC721URIStorage, Ownable, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    // Registry address
    address public registry;
    
    // Account implementation address
    address public implementation;
    
    // Mapping from token ID to creator address
    mapping(uint256 => address) private _creators;
    
    // Mapping from token ID to mixtape metadata
    mapping(uint256 => MixtapeMetadata) private _mixtapeMetadata;
    
    // Mapping from token ID to TBA address
    mapping(uint256 => address) private _tokenBoundAccounts;
    
    // Mapping from token ID to play price
    mapping(uint256 => uint256) private _playPrices;
    
    // Mixtape metadata struct
    struct MixtapeMetadata {
        string title;
        string description;
        string[] trackIds; // IDs of tracks in the mixtape
        uint256 createdAt;
    }
    
    // Events
    event MixtapeCreated(uint256 indexed tokenId, address indexed creator, string title);
    event TrackAdded(uint256 indexed tokenId, string trackId);
    event TokenBoundAccountCreated(uint256 indexed tokenId, address indexed tbaAddress);
    event PlayPriceSet(uint256 indexed tokenId, uint256 price);
    event MixtapePlayed(uint256 indexed tokenId, address indexed player, uint256 amount);
    
    constructor(address _registry, address _implementation) ERC721("Mixtape NFT", "MIXTAPE") Ownable() {
        registry = _registry;
        implementation = _implementation;
    }
    
    /**
     * @dev Creates a new mixtape NFT
     * @param recipient The address that will own the mixtape
     * @param title The title of the mixtape
     * @param description The description of the mixtape
     * @param tokenURI The URI for the mixtape's metadata
     * @param playPrice The price to play this mixtape
     * @return The ID of the newly created mixtape
     */
    function createMixtape(
        address recipient,
        string memory title,
        string memory description,
        string memory tokenURI,
        uint256 playPrice
    ) public whenNotPaused nonReentrant returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        
        _safeMint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);
        
        // Store creator
        _creators[newItemId] = msg.sender;
        
        // Store mixtape metadata
        _mixtapeMetadata[newItemId] = MixtapeMetadata({
            title: title,
            description: description,
            trackIds: new string[](0),
            createdAt: block.timestamp
        });
        
        // Set play price
        _playPrices[newItemId] = playPrice;
        
        // Create token bound account
        _createTokenBoundAccount(newItemId);
        
        emit MixtapeCreated(newItemId, msg.sender, title);
        emit PlayPriceSet(newItemId, playPrice);
        
        return newItemId;
    }
    
    /**
     * @dev Creates a token bound account for a mixtape
     * @param tokenId The ID of the mixtape
     * @return The address of the token bound account
     */
    function _createTokenBoundAccount(uint256 tokenId) internal returns (address) {
        // Interface for MixtapeRegistry.createAccount
        bytes memory createAccountCalldata = abi.encodeWithSignature(
            "createAccount(address,uint256,address,uint256,uint256,bytes)",
            implementation,
            block.chainid,
            address(this),
            tokenId,
            0, // salt
            "" // init data
        );
        
        (bool success, bytes memory returnData) = registry.call(createAccountCalldata);
        require(success, "MixtapeNFT: TBA creation failed");
        
        address tbaAddress = abi.decode(returnData, (address));
        _tokenBoundAccounts[tokenId] = tbaAddress;
        
        emit TokenBoundAccountCreated(tokenId, tbaAddress);
        
        return tbaAddress;
    }
    
    /**
     * @dev Plays a mixtape (pay-to-play mechanism)
     * @param tokenId The ID of the mixtape to play
     */
    function playMixtape(uint256 tokenId) external payable whenNotPaused nonReentrant {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        require(msg.value >= _playPrices[tokenId], "MixtapeNFT: Insufficient payment");
        
        address tba = _tokenBoundAccounts[tokenId];
        require(tba != address(0), "MixtapeNFT: TBA not created");
        
        // Forward payment to the token bound account
        (bool success, ) = tba.call{value: msg.value}("");
        require(success, "MixtapeNFT: Payment forwarding failed");
        
        emit MixtapePlayed(tokenId, msg.sender, msg.value);
    }
    
    /**
     * @dev Sets the play price for a mixtape
     * @param tokenId The ID of the mixtape
     * @param price The new play price
     */
    function setPlayPrice(uint256 tokenId, uint256 price) external {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "MixtapeNFT: Caller is not owner nor approved");
        
        _playPrices[tokenId] = price;
        
        emit PlayPriceSet(tokenId, price);
    }
    
    /**
     * @dev Gets the token bound account address for a mixtape
     * @param tokenId The ID of the mixtape
     * @return The address of the token bound account
     */
    function getTokenBoundAccount(uint256 tokenId) external view returns (address) {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        return _tokenBoundAccounts[tokenId];
    }
    
    /**
     * @dev Gets the play price for a mixtape
     * @param tokenId The ID of the mixtape
     * @return The play price
     */
    function getPlayPrice(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        return _playPrices[tokenId];
    }
    
    /**
     * @dev Adds a track to a mixtape
     * @param tokenId The ID of the mixtape
     * @param trackId The ID of the track to add
     */
    function addTrack(uint256 tokenId, string memory trackId) public whenNotPaused {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "MixtapeNFT: Caller is not owner nor approved");
        
        _mixtapeMetadata[tokenId].trackIds.push(trackId);
        
        emit TrackAdded(tokenId, trackId);
    }
    
    /**
     * @dev Gets the creator of a mixtape
     * @param tokenId The ID of the mixtape
     * @return The address of the creator
     */
    function getCreator(uint256 tokenId) public view returns (address) {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        return _creators[tokenId];
    }
    
    /**
     * @dev Gets the metadata of a mixtape
     * @param tokenId The ID of the mixtape
     * @return title The title of the mixtape
     * @return description The description of the mixtape
     * @return trackIds The IDs of tracks in the mixtape
     * @return createdAt The creation timestamp
     */
    function getMixtapeMetadata(uint256 tokenId) public view returns (
        string memory title,
        string memory description,
        string[] memory trackIds,
        uint256 createdAt
    ) {
        require(_exists(tokenId), "MixtapeNFT: Token does not exist");
        
        MixtapeMetadata memory metadata = _mixtapeMetadata[tokenId];
        
        return (
            metadata.title,
            metadata.description,
            metadata.trackIds,
            metadata.createdAt
        );
    }
    
    /**
     * @dev Gets the total number of mixtapes
     * @return The total number of mixtapes
     */
    function getTotalMixtapes() public view returns (uint256) {
        return _tokenIds.current();
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Updates the registry address
     * @param _registry The new registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "MixtapeNFT: Invalid registry address");
        registry = _registry;
    }
    
    /**
     * @dev Updates the implementation address
     * @param _implementation The new implementation address
     */
    function setImplementation(address _implementation) external onlyOwner {
        require(_implementation != address(0), "MixtapeNFT: Invalid implementation address");
        implementation = _implementation;
    }
}
