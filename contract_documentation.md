# Smart Contract Documentation

This file provides documentation for the smart contracts used in the Music Jukebox dApp.

## MixtapeRegistry

The MixtapeRegistry contract is responsible for creating and managing token bound accounts for mixtape NFTs. It implements the ERC-6551 registry standard.

### Key Functions

- `createAccount`: Creates a new token bound account for a mixtape NFT
- `account`: Gets the address of a token bound account

## MixtapeAccount

The MixtapeAccount contract is the implementation for token bound accounts. It provides functionality for rights management and executing transactions.

### Key Functions

- `initialize`: Initializes the account with token information
- `execute`: Executes a transaction from the account
- `token`: Gets the token information
- `owner`: Gets the owner of the account
- `setRights`: Sets rights data for the mixtape
- `getRights`: Gets rights data for the mixtape

## EnhancedMixtapeNFT

The EnhancedMixtapeNFT contract is an improved version of the original MixtapeNFT contract with TBA creation logic and pay-to-play functionality.

### Key Functions

- `createMixtape`: Creates a new mixtape NFT with a token bound account
- `playMixtape`: Allows playing a mixtape by paying the required fee
- `setPlayPrice`: Sets the play price for a mixtape
- `addTrack`: Adds a track to a mixtape
- `getTokenBoundAccount`: Gets the token bound account address for a mixtape
- `getPlayPrice`: Gets the play price for a mixtape
- `getMixtapeMetadata`: Gets the metadata of a mixtape

## MixtapeJukebox

The MixtapeJukebox contract is the mother account for the music jukebox dApp. It manages platform fees and play history.

### Key Functions

- `playMixtape`: Plays a mixtape through the jukebox
- `getPlayCount`: Gets the play count for a mixtape
- `getUserPlayHistory`: Gets the play history for a user
- `setPlatformFeePercentage`: Sets the platform fee percentage
- `withdrawFees`: Withdraws platform fees

## EnhancedMixtapeSocialRegistry

The EnhancedMixtapeSocialRegistry contract is an improved version of the original MixtapeSocialRegistry contract with TBA verification and better security.

### Key Functions

- `like`: Likes a mixtape
- `unlike`: Unlikes a mixtape
- `addComment`: Adds a comment to a mixtape
- `hasLiked`: Checks if an address has liked a mixtape
- `getLikesCount`: Gets the number of likes a mixtape has received
- `getComments`: Gets the comments for a mixtape
- `getCommentsCount`: Gets the number of comments a mixtape has received
