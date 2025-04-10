// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnhancedMixtapeSocialRegistry
 * @dev Enhanced registry for social interactions between mixtape token bound accounts
 */
contract EnhancedMixtapeSocialRegistry is Ownable, Pausable, ReentrancyGuard {
    // MixtapeNFT contract address
    address public mixtapeNFT;
    
    // Mapping from mixtape TBA address to likes received
    mapping(address => uint256) private _likesCount;
    
    // Mapping from mixtape TBA address to addresses that liked it
    mapping(address => mapping(address => bool)) private _likes;
    
    // Comment struct
    struct Comment {
        address author;
        string text;
        uint256 timestamp;
    }
    
    // Mapping from mixtape TBA address to comments
    mapping(address => Comment[]) private _comments;
    
    // Maximum number of comments per mixtape
    uint256 public maxCommentsPerMixtape = 1000;
    
    // Events
    event MixtapeLiked(address indexed mixtape, address indexed liker);
    event MixtapeUnliked(address indexed mixtape, address indexed unliker);
    event CommentAdded(address indexed mixtape, address indexed author, string text);
    event MaxCommentsPerMixtapeUpdated(uint256 newMax);
    
    constructor(address _mixtapeNFT) Ownable() {
        mixtapeNFT = _mixtapeNFT;
    }
    
    /**
     * @dev Verifies that an address is a valid mixtape TBA
     * @param mixtapeTba The address to verify
     * @return True if the address is a valid mixtape TBA
     */
    function _isValidMixtapeTba(address mixtapeTba) internal view returns (bool) {
        // Interface for MixtapeNFT.getTokenBoundAccount
        bytes memory getTokenBoundAccountCalldata = abi.encodeWithSignature(
            "getTokenBoundAccount(uint256)",
            0 // We'll try with token ID 0 first
        );
        
        // This is a simplified check. In a real implementation, you would need to
        // iterate through all token IDs or use a more efficient approach.
        (bool success, bytes memory returnData) = mixtapeNFT.staticcall(getTokenBoundAccountCalldata);
        if (!success) {
            return false;
        }
        
        address tbaAddress = abi.decode(returnData, (address));
        return tbaAddress == mixtapeTba;
    }
    
    /**
     * @dev Likes a mixtape
     * @param mixtapeTba The address of the mixtape's token bound account
     * @return True if the operation was successful
     */
    function like(address mixtapeTba) external whenNotPaused nonReentrant returns (bool) {
        require(mixtapeTba != address(0), "MixtapeSocialRegistry: Invalid mixtape address");
        require(mixtapeTba != msg.sender, "MixtapeSocialRegistry: Cannot like your own mixtape");
        require(!_likes[mixtapeTba][msg.sender], "MixtapeSocialRegistry: Already liked");
        require(_isValidMixtapeTba(mixtapeTba), "MixtapeSocialRegistry: Not a valid mixtape TBA");
        
        _likes[mixtapeTba][msg.sender] = true;
        _likesCount[mixtapeTba]++;
        
        emit MixtapeLiked(mixtapeTba, msg.sender);
        
        return true;
    }
    
    /**
     * @dev Unlikes a mixtape
     * @param mixtapeTba The address of the mixtape's token bound account
     * @return True if the operation was successful
     */
    function unlike(address mixtapeTba) external whenNotPaused nonReentrant returns (bool) {
        require(mixtapeTba != address(0), "MixtapeSocialRegistry: Invalid mixtape address");
        require(_likes[mixtapeTba][msg.sender], "MixtapeSocialRegistry: Not liked yet");
        
        _likes[mixtapeTba][msg.sender] = false;
        _likesCount[mixtapeTba]--;
        
        emit MixtapeUnliked(mixtapeTba, msg.sender);
        
        return true;
    }
    
    /**
     * @dev Adds a comment to a mixtape
     * @param mixtapeTba The address of the mixtape's token bound account
     * @param text The comment text
     * @return True if the operation was successful
     */
    function addComment(address mixtapeTba, string memory text) external whenNotPaused nonReentrant returns (bool) {
        require(mixtapeTba != address(0), "MixtapeSocialRegistry: Invalid mixtape address");
        require(bytes(text).length > 0, "MixtapeSocialRegistry: Empty comment");
        require(bytes(text).length <= 280, "MixtapeSocialRegistry: Comment too long");
        require(_comments[mixtapeTba].length < maxCommentsPerMixtape, "MixtapeSocialRegistry: Too many comments");
        require(_isValidMixtapeTba(mixtapeTba), "MixtapeSocialRegistry: Not a valid mixtape TBA");
        
        Comment memory newComment = Comment({
            author: msg.sender,
            text: text,
            timestamp: block.timestamp
        });
        
        _comments[mixtapeTba].push(newComment);
        
        emit CommentAdded(mixtapeTba, msg.sender, text);
        
        return true;
    }
    
    /**
     * @dev Checks if an address has liked a mixtape
     * @param mixtapeTba The address of the mixtape's token bound account
     * @param liker The address to check
     * @return True if the address has liked the mixtape
     */
    function hasLiked(address mixtapeTba, address liker) external view returns (bool) {
        return _likes[mixtapeTba][liker];
    }
    
    /**
     * @dev Gets the number of likes a mixtape has received
     * @param mixtapeTba The address of the mixtape's token bound account
     * @return The number of likes
     */
    function getLikesCount(address mixtapeTba) external view returns (uint256) {
        return _likesCount[mixtapeTba];
    }
    
    /**
     * @dev Gets the comments for a mixtape
     * @param mixtapeTba The address of the mixtape's token bound account
     * @return Array of comments
     */
    function getComments(address mixtapeTba) external view returns (Comment[] memory) {
        return _comments[mixtapeTba];
    }
    
    /**
     * @dev Gets the number of comments a mixtape has received
     * @param mixtapeTba The address of the mixtape's token bound account
     * @return The number of comments
     */
    function getCommentsCount(address mixtapeTba) external view returns (uint256) {
        return _comments[mixtapeTba].length;
    }
    
    /**
     * @dev Sets the maximum number of comments per mixtape
     * @param _maxCommentsPerMixtape The new maximum
     */
    function setMaxCommentsPerMixtape(uint256 _maxCommentsPerMixtape) external onlyOwner {
        maxCommentsPerMixtape = _maxCommentsPerMixtape;
        emit MaxCommentsPerMixtapeUpdated(_maxCommentsPerMixtape);
    }
    
    /**
     * @dev Updates the MixtapeNFT contract address
     * @param _mixtapeNFT The new MixtapeNFT contract address
     */
    function setMixtapeNFT(address _mixtapeNFT) external onlyOwner {
        require(_mixtapeNFT != address(0), "MixtapeSocialRegistry: Invalid MixtapeNFT address");
        mixtapeNFT = _mixtapeNFT;
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
}
