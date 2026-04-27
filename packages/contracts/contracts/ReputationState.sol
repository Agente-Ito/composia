// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationState
 * @notice Single source of truth for agent identity across chains.
 *
 * Architecture:
 *   Layer 1 — ENS text records          : historical baseline ("was ever verified", gensyn:*)
 *   Layer 2 — This contract (Ethereum)  : mutable reactive state (verified? slashed? quorum?)
 *
 * Bidirectional lookups:
 *   Forward:  agentEoa → ensNode / upAddress / ensLabels
 *   Backward: ensNode → agentEoa / upAddress
 *   ENS label → agentEoa
 *
 * DeFi/governance composability hooks:
 *   isCurrentlyVerified(node) → bool
 *   getQuorum(node)           → uint256 (50%+1 followers)
 *   getCurrentStatus(node)    → tuple
 *   resolveAgent(node)        → (agentEoa, upAddress)
 *
 * Reputation stored in basis points: 8500 = 85.00 %
 * Verification threshold: 6000 bps (60%), adjustable by owner.
 */
contract ReputationState is Ownable {

    uint256 public verificationThreshold = 6000;

    struct AgentStatus {
        bytes32 ensNode;
        uint256 reputation;
        bool    isCurrentlyVerified;
        bool    isSlashed;
        uint256 lastSlashTime;
        uint256 slashDuration;
        uint256 followerCount;
        uint256 lastUpdated;
    }

    // ── Primary state: ENS node → agent status ────────────────────────────────
    mapping(bytes32 => AgentStatus) public agentStatus;

    // ── Bidirectional identity mappings ───────────────────────────────────────
    mapping(address => bytes32)  public agentToNode;       // EOA → primary ENS node
    mapping(address => address)  public agentToUP;         // EOA → UP address (Ethereum cache)
    mapping(bytes32  => address) public nodeToAgent;       // ENS node → EOA
    mapping(bytes32  => address) public nodeToUP;          // ENS node → UP address

    // ── ENS names per agent ───────────────────────────────────────────────────
    // Agent can have multiple labels (auto + custom). Primary = index 0.
    mapping(address => string[])  private _agentLabels;    // EOA → [label1, label2, ...]
    mapping(string  => address)   public  labelToAgent;    // ENS label → EOA

    // ── Sepolia-native followers ───────────────────────────────────────────────
    mapping(bytes32 => address[]) private _followers;
    mapping(bytes32 => mapping(address => bool)) private _isFollower;

    address public reputationOracle;

    // ── Events ────────────────────────────────────────────────────────────────
    event AgentRegistered(address indexed agent, address upAddress, bytes32 ensNode, string label);
    event ENSLabelAdded(address indexed agent, string label, bytes32 node);
    event ReputationChanged(bytes32 indexed node, uint256 newRep, bool verified);
    event AgentSlashed(bytes32 indexed node, uint256 duration, string reason);
    event AgentRestored(bytes32 indexed node);
    event FollowerCountSynced(bytes32 indexed node, uint256 count);
    event FollowerAdded(bytes32 indexed node, address follower);
    event FollowerRemoved(bytes32 indexed node, address follower);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);

    modifier onlyOracleOrOwner() {
        require(msg.sender == reputationOracle || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address initialOwner, address _oracle) Ownable(initialOwner) {
        reputationOracle = _oracle;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        reputationOracle = _oracle;
    }

    function setVerificationThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold <= 10000, "Max 10000");
        emit ThresholdChanged(verificationThreshold, _threshold);
        verificationThreshold = _threshold;
    }

    // ── Agent registration (called by oracle when UP is created) ──────────────

    /**
     * @notice Register a new agent: links EOA → UP → ENS node, and stores the
     *         auto-generated label (first 8 hex chars of the EOA).
     *         Called by the listener immediately after ENS subdomain creation.
     */
    function registerAgent(
        address agent,
        address upAddress,
        bytes32 ensNode,
        string  calldata label
    ) external onlyOracleOrOwner {
        agentToNode[agent]    = ensNode;
        agentToUP[agent]      = upAddress;
        nodeToAgent[ensNode]  = agent;
        nodeToUP[ensNode]     = upAddress;

        // Seed AgentStatus node reference
        agentStatus[ensNode].ensNode = ensNode;

        // Add auto-generated label as first (primary) label
        if (_agentLabels[agent].length == 0) {
            _agentLabels[agent].push(label);
            labelToAgent[label] = agent;
        }

        emit AgentRegistered(agent, upAddress, ensNode, label);
    }

    /**
     * @notice Add an additional ENS label for an agent (custom name registered later).
     *         Called by ENSNameManager after the subdomain is created.
     */
    function addENSLabel(address agent, string calldata label) external onlyOracleOrOwner {
        require(agentToNode[agent] != bytes32(0), "Agent not registered");
        require(labelToAgent[label] == address(0), "Label already mapped");
        _agentLabels[agent].push(label);
        labelToAgent[label] = agent;

        bytes32 node = _namehash(label);
        emit ENSLabelAdded(agent, label, node);
    }

    // ── Oracle writes ─────────────────────────────────────────────────────────

    /**
     * @notice Update reputation and derived verification status.
     *         Called by listener after each Gensyn round sync.
     * @param newReputation  Accuracy in basis points (accuracy% × 100; e.g. 85% → 8500)
     * @param shouldBeVerified  Oracle intent; auto-overridden to false if below threshold
     */
    function updateVerificationStatus(
        bytes32 node,
        uint256 newReputation,
        bool    shouldBeVerified
    ) external onlyOracleOrOwner {
        require(newReputation <= 10000, "Max 10000 bps");
        AgentStatus storage s = agentStatus[node];
        s.ensNode             = node;
        s.reputation          = newReputation;
        s.lastUpdated         = block.timestamp;
        s.isCurrentlyVerified = shouldBeVerified && (newReputation >= verificationThreshold);
        emit ReputationChanged(node, newReputation, s.isCurrentlyVerified);
    }

    /**
     * @notice Sync follower count from Lukso LSP26 (called periodically by oracle).
     */
    function syncFollowerCount(bytes32 node, uint256 count) external onlyOracleOrOwner {
        agentStatus[node].followerCount = count;
        emit FollowerCountSynced(node, count);
    }

    // ── Governance writes ─────────────────────────────────────────────────────

    /**
     * @notice Slash an agent for a fixed duration (temporary penalty).
     *         Slash expires automatically — no manual restore needed.
     */
    function slashAgent(bytes32 node, uint256 durationSeconds, string calldata reason) external onlyOwner {
        require(durationSeconds > 0, "Duration must be > 0");
        AgentStatus storage s = agentStatus[node];
        s.isSlashed           = true;
        s.lastSlashTime       = block.timestamp;
        s.slashDuration       = durationSeconds;
        s.isCurrentlyVerified = false;
        emit AgentSlashed(node, durationSeconds, reason);
    }

    /**
     * @notice Appeal granted — remove slash before expiry.
     *         Restores verification if reputation still meets threshold.
     */
    function restoreAgent(bytes32 node) external onlyOwner {
        AgentStatus storage s = agentStatus[node];
        s.isSlashed           = false;
        s.isCurrentlyVerified = s.reputation >= verificationThreshold;
        emit AgentRestored(node);
    }

    /**
     * @notice Public: settle an expired slash without waiting for a read call.
     */
    function settleSlash(bytes32 node) external {
        AgentStatus storage s = agentStatus[node];
        if (s.isSlashed && block.timestamp >= s.lastSlashTime + s.slashDuration) {
            s.isSlashed           = false;
            s.isCurrentlyVerified = s.reputation >= verificationThreshold;
            emit AgentRestored(node);
        }
    }

    // ── Sepolia-native followers ───────────────────────────────────────────────

    function addFollower(bytes32 node, address follower) external {
        require(!_isFollower[node][follower], "Already following");
        _followers[node].push(follower);
        _isFollower[node][follower] = true;
        emit FollowerAdded(node, follower);
    }

    function removeFollower(bytes32 node) external {
        address follower = msg.sender;
        require(_isFollower[node][follower], "Not following");
        _isFollower[node][follower] = false;
        address[] storage list = _followers[node];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == follower) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
        emit FollowerRemoved(node, follower);
    }

    // ── Primary composability hooks ───────────────────────────────────────────

    /**
     * @notice Checks if an agent is currently verified.
     *         Returns false if slashed (even if not yet settled) or below threshold.
     *         Integrations: Aave LTV, DAO voting multiplier, marketplace access.
     */
    function isCurrentlyVerified(bytes32 node) external view returns (bool) {
        AgentStatus memory s = agentStatus[node];
        if (s.isSlashed && block.timestamp < s.lastSlashTime + s.slashDuration) return false;
        if (s.reputation < verificationThreshold) return false;
        return s.isCurrentlyVerified;
    }

    /**
     * @notice Full status with auto-settled slash (view — no storage write).
     */
    function getCurrentStatus(bytes32 node) external view returns (
        uint256 reputation,
        bool    verified,
        bool    slashed,
        uint256 slashExpiresAt,
        uint256 followerCount,
        uint256 lastUpdated
    ) {
        AgentStatus memory s = agentStatus[node];
        bool activeSlash = s.isSlashed && block.timestamp < s.lastSlashTime + s.slashDuration;
        reputation     = s.reputation;
        verified       = !activeSlash && s.isCurrentlyVerified;
        slashed        = activeSlash;
        slashExpiresAt = s.isSlashed ? s.lastSlashTime + s.slashDuration : 0;
        followerCount  = s.followerCount;
        lastUpdated    = s.lastUpdated;
    }

    /**
     * @notice Governance quorum: 50%+1 of followers.
     *         Uses oracle-synced count from Lukso LSP26 or Sepolia-native followers,
     *         whichever is larger.
     */
    function getQuorum(bytes32 node) external view returns (uint256) {
        uint256 oracle  = agentStatus[node].followerCount;
        uint256 sepolia = _followers[node].length;
        uint256 count   = oracle > sepolia ? oracle : sepolia;
        return count == 0 ? 1 : count / 2 + 1;
    }

    /**
     * @notice Bidirectional resolution: ENS node → (agentEoa, upAddress).
     *         Useful for DeFi contracts that receive an ENS node and need the agent.
     */
    function resolveAgent(bytes32 node) external view returns (address agentEoa, address upAddress) {
        agentEoa  = nodeToAgent[node];
        upAddress = nodeToUP[node];
    }

    function isFollower(bytes32 node, address follower) external view returns (bool) {
        return _isFollower[node][follower];
    }

    function getSepoliaFollowers(bytes32 node) external view returns (address[] memory) {
        return _followers[node];
    }

    function getAgentLabels(address agent) external view returns (string[] memory) {
        return _agentLabels[agent];
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @dev Compute namehash("{label}.composia.eth") for ENS label lookup.
     *      Used only in events — not for critical path state.
     */
    function _namehash(string memory label) internal pure returns (bytes32) {
        // namehash("composia.eth") — precomputed constant
        bytes32 composiaEthNode = 0xc373aff38a7026593e56ed4ccdab21b1d039f3aeb36ce22f491fe2ad86ebd997;
        return keccak256(abi.encodePacked(composiaEthNode, keccak256(bytes(label))));
    }
}
