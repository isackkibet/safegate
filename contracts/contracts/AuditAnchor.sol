// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AuditAnchor
/// @notice Anchors a hash of every SafeGate Guardian decision (approved or denied)
///         on-chain, so the decision record in Postgres cannot be silently altered
///         after the fact. Judges/regulators verify by recomputing the hash of a
///         database row and checking it matches what was anchored, at the time claimed.
contract AuditAnchor is Ownable {
    mapping(address => bool) public anchorers;

    struct Anchor {
        bytes32 recordHash;
        uint256 timestamp;
        address anchoredBy;
    }

    Anchor[] public anchors;
    mapping(bytes32 => uint256) private hashToAnchorId; // 1-indexed; 0 = not found
    mapping(bytes32 => bool) private hashExists;

    event Anchored(uint256 indexed anchorId, bytes32 indexed recordHash, address indexed anchoredBy, uint256 timestamp);
    event AnchorerUpdated(address indexed anchorer, bool approved);

    constructor() Ownable(msg.sender) {}

    modifier onlyAnchorer() {
        require(anchorers[msg.sender], "SafeGate: not an approved anchorer");
        _;
    }

    /// @notice Approve or remove a backend signer address allowed to anchor decision hashes.
    function setAnchorer(address anchorer, bool approved) external onlyOwner {
        anchorers[anchorer] = approved;
        emit AnchorerUpdated(anchorer, approved);
    }

    /// @notice Anchor the hash of a Guardian decision record.
    /// @param recordHash keccak256 hash of the canonical JSON of the authorization_attempts row.
    /// @return anchorId Index of this anchor in the anchors array.
    function anchor(bytes32 recordHash) external onlyAnchorer returns (uint256 anchorId) {
        require(!hashExists[recordHash], "SafeGate: hash already anchored");

        anchors.push(Anchor({
            recordHash: recordHash,
            timestamp: block.timestamp,
            anchoredBy: msg.sender
        }));

        anchorId = anchors.length - 1;
        hashToAnchorId[recordHash] = anchorId + 1; // store 1-indexed
        hashExists[recordHash] = true;

        emit Anchored(anchorId, recordHash, msg.sender, block.timestamp);
    }

    /// @notice Verify whether a given hash was anchored, and when.
    function verify(bytes32 recordHash) external view returns (bool exists, uint256 timestamp, address anchoredBy) {
        if (!hashExists[recordHash]) {
            return (false, 0, address(0));
        }
        uint256 idx = hashToAnchorId[recordHash] - 1;
        Anchor memory a = anchors[idx];
        return (true, a.timestamp, a.anchoredBy);
    }

    function totalAnchors() external view returns (uint256) {
        return anchors.length;
    }
}
