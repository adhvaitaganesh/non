// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IMixtapeAccount.sol";

/**
 * @title MixtapeAccount
 * @dev Implementation for mixtape token bound accounts
 */
contract MixtapeAccount is IMixtapeAccount, IERC165, ReentrancyGuard {
    // Token information
    uint256 private _chainId;
    address private _tokenContract;
    uint256 private _tokenId;
    uint256 private _salt;
    
    // Rights management
    mapping(string => bytes) private _rights;
    
    // Initialization status
    bool private _initialized;
    
    // Events
    event Executed(address indexed to, uint256 value, bytes data);
    event RightsUpdated(string key, bytes data);
    
    modifier onlyOwner() {
        require(msg.sender == owner(), "MixtapeAccount: Not the owner");
        _;
    }
    
    /**
     * @dev Initializes the account
     * @param chainId The chain ID where the NFT exists
     * @param tokenContract The address of the NFT contract
     * @param tokenId The ID of the NFT
     * @param salt A unique salt for account creation
     */
    function initialize(
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external {
        require(!_initialized, "MixtapeAccount: Already initialized");
        
        _chainId = chainId;
        _tokenContract = tokenContract;
        _tokenId = tokenId;
        _salt = salt;
        _initialized = true;
    }
    
    /**
     * @dev Executes a transaction from the account
     * @param to The target address
     * @param value The amount of ETH to send
     * @param data The calldata
     * @return The return data from the call
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyOwner nonReentrant returns (bytes memory) {
        (bool success, bytes memory result) = to.call{value: value}(data);
        require(success, "MixtapeAccount: Execution failed");
        
        emit Executed(to, value, data);
        
        return result;
    }
    
    /**
     * @dev Gets the token information
     * @return chainId The chain ID where the NFT exists
     * @return tokenContract The address of the NFT contract
     * @return tokenId The ID of the NFT
     */
    function token() external view returns (
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) {
        return (_chainId, _tokenContract, _tokenId);
    }
    
    /**
     * @dev Gets the owner of the account
     * @return The owner address
     */
    function owner() public view returns (address) {
        if (_chainId != block.chainid) {
            return address(0);
        }
        
        try IERC721(_tokenContract).ownerOf(_tokenId) returns (address tokenOwner) {
            return tokenOwner;
        } catch {
            return address(0);
        }
    }
    
    /**
     * @dev Sets rights data for the mixtape
     * @param key The rights key
     * @param data The rights data
     */
    function setRights(string memory key, bytes memory data) external onlyOwner {
        _rights[key] = data;
        emit RightsUpdated(key, data);
    }
    
    /**
     * @dev Gets rights data for the mixtape
     * @param key The rights key
     * @return The rights data
     */
    function getRights(string memory key) external view returns (bytes memory) {
        return _rights[key];
    }
    
    /**
     * @dev Checks if the contract supports an interface
     * @param interfaceId The interface ID
     * @return True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IMixtapeAccount).interfaceId;
    }
    
    /**
     * @dev Receives ETH
     */
    receive() external payable {}
}
