// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
