// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AOPRegistry
 * @notice On-chain registry of completed pipeline outputs.
 *
 * When an AOP deliberation pipeline completes, the backend hashes all slot
 * outputs and commits the root hash here. This establishes tamper-evidence:
 * any change to the pipeline outputs in the off-chain database would produce
 * a different hash, making manipulation detectable.
 *
 * This is Phase 1 of Proof of Intelligence (PoI) — the chain knows pipelines
 * happened and what they produced. Phases 2-3 add staking and signed submissions.
 *
 * Hash format: keccak256 of the JSON-encoded sorted slot outputs (see convex/registry.ts)
 */
contract AOPRegistry is Ownable {

    struct PipelineRecord {
        bytes32 outputHash;    // keccak256 of all slot outputs
        uint256 committedAt;   // block.timestamp when committed
        uint32  agentCount;    // number of agents who participated
        uint32  layerCount;    // number of layers in the pipeline
    }

    /// @notice claimId (keccak256 of Convex ID string) → pipeline record
    mapping(bytes32 => PipelineRecord) public pipelineRecords;

    /// @notice Total pipelines committed to this registry
    uint256 public totalCommitted;

    event PipelineCommitted(
        bytes32 indexed claimId,
        bytes32 outputHash,
        uint32  agentCount,
        uint32  layerCount,
        uint256 committedAt
    );

    constructor() Ownable(msg.sender) {}

    // ── Commit ────────────────────────────────────────────────────────

    /**
     * @notice Commit the output hash of a completed pipeline.
     * @param claimId     keccak256 of the Convex claim ID string
     * @param outputHash  keccak256 of all slot outputs (see convex/registry.ts)
     * @param agentCount  number of distinct agents who completed slots
     * @param layerCount  number of layers the pipeline ran
     */
    function commitPipelineHash(
        bytes32 claimId,
        bytes32 outputHash,
        uint32  agentCount,
        uint32  layerCount
    ) external onlyOwner {
        require(pipelineRecords[claimId].committedAt == 0, "AOPRegistry: already committed");
        require(outputHash != bytes32(0), "AOPRegistry: empty hash");

        pipelineRecords[claimId] = PipelineRecord({
            outputHash:  outputHash,
            committedAt: block.timestamp,
            agentCount:  agentCount,
            layerCount:  layerCount
        });

        totalCommitted++;

        emit PipelineCommitted(claimId, outputHash, agentCount, layerCount, block.timestamp);
    }

    // ── Verify ────────────────────────────────────────────────────────

    /**
     * @notice Verify that a given hash matches the committed record for a claim.
     * @param claimId    keccak256 of the Convex claim ID string
     * @param outputHash Hash to verify against the committed record
     * @return true if the hash matches and a record exists
     */
    function verify(bytes32 claimId, bytes32 outputHash) external view returns (bool) {
        PipelineRecord storage r = pipelineRecords[claimId];
        return r.committedAt != 0 && r.outputHash == outputHash;
    }

    /**
     * @notice Check whether a pipeline has been committed.
     */
    function isCommitted(bytes32 claimId) external view returns (bool) {
        return pipelineRecords[claimId].committedAt != 0;
    }
}
