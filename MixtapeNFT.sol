// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title MixtapeNFT
 * @dev ERC721 token representing mixtapes that can have token bound accounts
 */
contract MixtapeNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    // Mapping from token ID to creator address
    mapping(uint256 => address) private _creators;
    
    // Mapping from token ID to mixtape metadata
    mapping(uint256 => MixtapeMetadata) private _mixtapeMetadata;
    
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
    
    constructor() ERC721("Mixtape NFT", "MIXTAPE") Ownable() {}
    
    /**
     * @dev Creates a new mixtape NFT
     * @param recipient The address that will own the mixtape
     * @param title The title of the mixtape
     * @param description The description of the mixtape
     * @param tokenURI The URI for the mixtape's metadata
     * @return The ID of the newly created mixtape
     */
    function createMixtape(
        address recipient,
        string memory title,
        string memory description,
        string memory tokenURI
    ) public returns (uint256) {
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
        
        emit MixtapeCreated(newItemId, msg.sender, title);
        
        return newItemId;
    }
    
    /**
     * @dev Adds a track to a mixtape
     * @param tokenId The ID of the mixtape
     * @param trackId The ID of the track to add
     */
    function addTrack(uint256 tokenId, string memory trackId) public {
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
}
