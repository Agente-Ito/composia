// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SyncerContract
 * @notice Deployed on destination chains (e.g., Ethereum Sepolia).
 *         Stores agent reputation data received from Lukso via cross-chain message.
 *
 *         For the hackathon demo, the `relayer` address calls receiveMessage() directly.
 *         In production this would be called by the Hyperlane ISM (Interchain Security Module).
 */
contract SyncerContract is Ownable {
    struct ReputationSnapshot {
        uint96  accuracy;
        uint96  verifications;
        uint64  receivedAt;
    }

    /// Gensyn agent address → latest reputation snapshot on this chain
    mapping(address => ReputationSnapshot) public agentReputation;

    address[] private _allAgents;
    mapping(address => bool) private _knownAgent;

    /// Address authorized to push reputation updates (relayer wallet in demo, Hyperlane ISM in prod)
    address public relayer;

    string public sourceChain; // e.g. "lukso-testnet"

    event ReputationReceived(address indexed agent, uint96 accuracy, uint96 verifications);
    event BatchReceived(uint256 agentCount);
    event RelayerChanged(address indexed oldRelayer, address indexed newRelayer);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    constructor(address initialOwner, address _relayer, string memory _sourceChain)
        Ownable(initialOwner)
    {
        relayer     = _relayer;
        sourceChain = _sourceChain;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setRelayer(address _relayer) external onlyOwner {
        emit RelayerChanged(relayer, _relayer);
        relayer = _relayer;
    }

    // ─── Receive messages ─────────────────────────────────────────────────────

    /**
     * @notice Receive a single agent reputation update.
     *         Called by the relayer / Hyperlane ISM.
     */
    function receiveMessage(
        address agent,
        uint96  accuracy,
        uint96  verifications
    ) external onlyRelayer {
        require(agent != address(0), "Zero address");
        require(accuracy <= 100, "Accuracy must be 0-100");

        _updateAgent(agent, accuracy, verifications);
        emit ReputationReceived(agent, accuracy, verifications);
    }

    /**
     * @notice Receive a batch of reputation updates (gas-efficient).
     */
    function receiveBatch(
        address[] calldata agents,
        uint96[]  calldata accuracies,
        uint96[]  calldata verificationCounts
    ) external onlyRelayer {
        require(
            agents.length == accuracies.length &&
            agents.length == verificationCounts.length,
            "Array length mismatch"
        );
        for (uint256 i = 0; i < agents.length; i++) {
            _updateAgent(agents[i], accuracies[i], verificationCounts[i]);
        }
        emit BatchReceived(agents.length);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getReputation(address agent) external view returns (
        uint96  accuracy,
        uint96  verifications,
        uint64  receivedAt
    ) {
        ReputationSnapshot memory s = agentReputation[agent];
        return (s.accuracy, s.verifications, s.receivedAt);
    }

    function getAllAgents() external view returns (address[] memory) {
        return _allAgents;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _updateAgent(address agent, uint96 accuracy, uint96 verifications) internal {
        if (!_knownAgent[agent]) {
            _knownAgent[agent] = true;
            _allAgents.push(agent);
        }
        agentReputation[agent] = ReputationSnapshot({
            accuracy:      accuracy,
            verifications: verifications,
            receivedAt:    uint64(block.timestamp)
        });
    }
}
