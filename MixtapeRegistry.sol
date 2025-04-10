// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title MixtapeRegistry
 * @dev Registry for creating and managing token bound accounts for mixtape NFTs
 */
contract MixtapeRegistry {
    // Event emitted when a new account is created
    event AccountCreated(
        address indexed account,
        address indexed implementation,
        uint256 chainId,
        address indexed tokenContract,
        uint256 tokenId,
        uint256 salt
    );
    
    /**
     * @dev Creates a token bound account for a mixtape NFT
     * @param implementation The implementation contract for the account
     * @param chainId The chain ID where the NFT exists
     * @param tokenContract The address of the NFT contract
     * @param tokenId The ID of the NFT
     * @param salt A unique salt for account creation
     * @param initData Initialization data for the account
     * @return The address of the created account
     */
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes memory initData
    ) external returns (address) {
        bytes memory deploymentData = _getCreationCode(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        
        address accountAddress = Create2.computeAddress(
            bytes32(salt),
            keccak256(deploymentData)
        );
        
        if (accountAddress.code.length > 0) {
            return accountAddress;
        }
        
        accountAddress = Create2.deploy(0, bytes32(salt), deploymentData);
        
        if (initData.length > 0) {
            (bool success, ) = accountAddress.call(initData);
            require(success, "MixtapeRegistry: Initialization failed");
        }
        
        emit AccountCreated(
            accountAddress,
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        
        return accountAddress;
    }
    
    /**
     * @dev Computes the address of a token bound account
     * @param implementation The implementation contract for the account
     * @param chainId The chain ID where the NFT exists
     * @param tokenContract The address of the NFT contract
     * @param tokenId The ID of the NFT
     * @param salt A unique salt for account creation
     * @return The address of the account
     */
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        bytes memory deploymentData = _getCreationCode(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(deploymentData)
        );
    }
    
    /**
     * @dev Gets the creation code for a token bound account
     * @param implementation The implementation contract for the account
     * @param chainId The chain ID where the NFT exists
     * @param tokenContract The address of the NFT contract
     * @param tokenId The ID of the NFT
     * @param salt A unique salt for account creation
     * @return The creation code
     */
    function _getCreationCode(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(
                implementation,
                abi.encodeCall(
                    IMixtapeAccount.initialize,
                    (chainId, tokenContract, tokenId, salt)
                )
            )
        );
    }
}

/**
 * @title IMixtapeAccount
 * @dev Interface for mixtape token bound accounts
 */
interface IMixtapeAccount {
    function initialize(
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external;
    
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory);
    
    function token() external view returns (
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    );
    
    function owner() external view returns (address);
}
