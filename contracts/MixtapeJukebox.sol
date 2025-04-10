// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MixtapeJukebox
 * @dev Mother account for the music jukebox dApp
 */
contract MixtapeJukebox is Ownable, Pausable, ReentrancyGuard {
    // MixtapeNFT contract address
    address public mixtapeNFT;
    
    // MixtapeSocialRegistry contract address
    address public socialRegistry;
    
    // Mapping from mixtape ID to play count
    mapping(uint256 => uint256) private _playCount;
    
    // Mapping from user address to mixtape IDs they've played
    mapping(address => uint256[]) private _userPlayHistory;
    
    // Platform fee percentage (in basis points, e.g., 250 = 2.5%)
    uint256 public platformFeePercentage = 250;
    
    // Events
    event MixtapePlayed(uint256 indexed mixtapeId, address indexed player, uint256 amount);
    event PlatformFeeUpdated(uint256 newFeePercentage);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    constructor(address _mixtapeNFT, address _socialRegistry) Ownable() {
        mixtapeNFT = _mixtapeNFT;
        socialRegistry = _socialRegistry;
    }
    
    /**
     * @dev Plays a mixtape
     * @param mixtapeId The ID of the mixtape to play
     */
    function playMixtape(uint256 mixtapeId) external payable whenNotPaused nonReentrant {
        // Interface for MixtapeNFT.getPlayPrice
        bytes memory getPlayPriceCalldata = abi.encodeWithSignature(
            "getPlayPrice(uint256)",
            mixtapeId
        );
        
        (bool success, bytes memory returnData) = mixtapeNFT.staticcall(getPlayPriceCalldata);
        require(success, "MixtapeJukebox: Failed to get play price");
        
        uint256 playPrice = abi.decode(returnData, (uint256));
        require(msg.value >= playPrice, "MixtapeJukebox: Insufficient payment");
        
        // Get the TBA address
        bytes memory getTbaCalldata = abi.encodeWithSignature(
            "getTokenBoundAccount(uint256)",
            mixtapeId
        );
        
        (success, returnData) = mixtapeNFT.staticcall(getTbaCalldata);
        require(success, "MixtapeJukebox: Failed to get TBA address");
        
        address tba = abi.decode(returnData, (address));
        require(tba != address(0), "MixtapeJukebox: TBA not created");
        
        // Calculate platform fee
        uint256 platformFee = (msg.value * platformFeePercentage) / 10000;
        uint256 artistPayment = msg.value - platformFee;
        
        // Forward payment to the TBA
        (success, ) = tba.call{value: artistPayment}("");
        require(success, "MixtapeJukebox: Payment forwarding failed");
        
        // Update play count
        _playCount[mixtapeId]++;
        
        // Update user play history
        _userPlayHistory[msg.sender].push(mixtapeId);
        
        emit MixtapePlayed(mixtapeId, msg.sender, msg.value);
    }
    
    /**
     * @dev Gets the play count for a mixtape
     * @param mixtapeId The ID of the mixtape
     * @return The play count
     */
    function getPlayCount(uint256 mixtapeId) external view returns (uint256) {
        return _playCount[mixtapeId];
    }
    
    /**
     * @dev Gets the play history for a user
     * @param user The address of the user
     * @return Array of mixtape IDs played by the user
     */
    function getUserPlayHistory(address user) external view returns (uint256[] memory) {
        return _userPlayHistory[user];
    }
    
    /**
     * @dev Sets the platform fee percentage
     * @param _platformFeePercentage The new platform fee percentage (in basis points)
     */
    function setPlatformFeePercentage(uint256 _platformFeePercentage) external onlyOwner {
        require(_platformFeePercentage <= 1000, "MixtapeJukebox: Fee too high"); // Max 10%
        platformFeePercentage = _platformFeePercentage;
        emit PlatformFeeUpdated(_platformFeePercentage);
    }
    
    /**
     * @dev Withdraws platform fees
     * @param recipient The address to send the fees to
     */
    function withdrawFees(address payable recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "MixtapeJukebox: Invalid recipient");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "MixtapeJukebox: No funds to withdraw");
        
        (bool success, ) = recipient.call{value: balance}("");
        require(success, "MixtapeJukebox: Withdrawal failed");
        
        emit FundsWithdrawn(recipient, balance);
    }
    
    /**
     * @dev Updates the MixtapeNFT contract address
     * @param _mixtapeNFT The new MixtapeNFT contract address
     */
    function setMixtapeNFT(address _mixtapeNFT) external onlyOwner {
        require(_mixtapeNFT != address(0), "MixtapeJukebox: Invalid MixtapeNFT address");
        mixtapeNFT = _mixtapeNFT;
    }
    
    /**
     * @dev Updates the MixtapeSocialRegistry contract address
     * @param _socialRegistry The new MixtapeSocialRegistry contract address
     */
    function setSocialRegistry(address _socialRegistry) external onlyOwner {
        require(_socialRegistry != address(0), "MixtapeJukebox: Invalid SocialRegistry address");
        socialRegistry = _socialRegistry;
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
     * @dev Receives ETH
     */
    receive() external payable {}
}
