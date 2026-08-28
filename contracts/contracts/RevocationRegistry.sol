// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RevocationRegistry
/// @notice On-chain status registry for SafeGate rider Verifiable Credentials.
///         Implements the same concept as W3C's StatusList2021: a place to check
///         whether a credential is still ACTIVE without trusting a single
///         database record, which could be edited after the fact.
contract RevocationRegistry is Ownable {
    // Only addresses approved by the owner (the platform backend) may revoke.
    mapping(address => bool) public issuers;

    // credentialId (the VC's own unique id, hashed) => revoked?
    mapping(bytes32 => bool) public revoked;
    mapping(bytes32 => uint256) public revokedAt;

    event IssuerUpdated(address indexed issuer, bool approved);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed revokedBy, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    modifier onlyIssuer() {
        require(issuers[msg.sender], "SafeGate: not an approved issuer");
        _;
    }

    /// @notice Approve or remove a backend signer address that is allowed to revoke credentials.
    function setIssuer(address issuer, bool approved) external onlyOwner {
        issuers[issuer] = approved;
        emit IssuerUpdated(issuer, approved);
    }

    /// @notice Revoke a rider's credential immediately. Irreversible by design —
    ///         a new credential must be issued if access should be restored.
    /// @param credentialId keccak256 hash of the VC's own "id" field (e.g. its urn:uuid).
    function revoke(bytes32 credentialId) external onlyIssuer {
        require(!revoked[credentialId], "SafeGate: already revoked");
        revoked[credentialId] = true;
        revokedAt[credentialId] = block.timestamp;
        emit CredentialRevoked(credentialId, msg.sender, block.timestamp);
    }

    /// @notice Check whether a credential is revoked. Called by the Guardian
    ///         before approving any COLLECT_COD or RELEASE_PACKAGE action.
    function isRevoked(bytes32 credentialId) external view returns (bool) {
        return revoked[credentialId];
    }
}
