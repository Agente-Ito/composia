// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AttestorRegistry
 * @notice Central registry mapping Gensyn agent addresses to Lukso Universal Profile
 *         addresses. Also stores on-chain reputation snapshots and manages the claim flow.
 *
 *         Universal Profiles are deployed off-chain by the listener (ethers.js direct
 *         contract deployment) and registered here. This avoids LSPFactory.js backend issues.
 */
contract AttestorRegistry is Ownable {
    struct ReputationData {
        uint96  accuracy;      // 0-100
        uint96  verifications; // total count
        uint64  lastUpdated;   // unix timestamp
        bool    synced;        // has been cross-chain synced
    }

    /// Gensyn agent address → Lukso UP address
    mapping(address => address) public agentToUP;

    /// Gensyn agent address → LSP6 KeyManager address
    mapping(address => address) public agentToKM;

    /// Lukso UP address → Gensyn agent address (reverse lookup)
    mapping(address => address) public upToAgent;

    /// Gensyn agent address → latest reputation snapshot
    mapping(address => ReputationData) public agentReputation;

    /// Tracks when an agent joined (first registration timestamp)
    mapping(address => uint256) public agentJoinedAt;

    /// Address allowed to register and update profiles (listener wallet)
    address public attestor;

    address[] private _allAgents;

    event ProfileRegistered(address indexed agent, address indexed upAddress);
    event ReputationUpdated(address indexed agent, uint96 accuracy, uint96 verifications);
    event ProfileClaimed(address indexed agent, address indexed upAddress, address indexed newOwner);
    event AttestorChanged(address indexed oldAttestor, address indexed newAttestor);
    event SyncStatusUpdated(address indexed agent, bool synced);

    modifier onlyAttestor() {
        require(msg.sender == attestor, "Not attestor");
        _;
    }

    constructor(address initialOwner, address _attestor) Ownable(initialOwner) {
        attestor = _attestor;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setAttestor(address _attestor) external onlyOwner {
        emit AttestorChanged(attestor, _attestor);
        attestor = _attestor;
    }

    // ─── Write (attestor only) ───────────────────────────────────────────────

    /**
     * @notice Register a Universal Profile + LSP6 KeyManager for a Gensyn agent.
     *         Called by the listener after deploying UP + KM off-chain.
     *         Composia retains SETDATA permission via the KM so it can keep
     *         writing gensyn:* reputation keys after the agent claims ownership.
     */
    function registerUP(address agent, address upAddress, address kmAddress) external onlyAttestor {
        require(agent != address(0) && upAddress != address(0) && kmAddress != address(0), "Zero address");
        require(agentToUP[agent] == address(0), "UP already registered");

        agentToUP[agent] = upAddress;
        agentToKM[agent] = kmAddress;
        upToAgent[upAddress] = agent;
        agentJoinedAt[agent] = block.timestamp;
        _allAgents.push(agent);

        emit ProfileRegistered(agent, upAddress);
    }

    /**
     * @notice Update the on-chain reputation snapshot for an agent.
     *         Called by the listener after writing LSP3 data to the UP.
     */
    function updateReputation(
        address agent,
        uint96  accuracy,
        uint96  verifications
    ) external onlyAttestor {
        require(agentToUP[agent] != address(0), "Agent not registered");
        require(accuracy <= 100, "Accuracy must be 0-100");

        ReputationData storage rep = agentReputation[agent];
        rep.accuracy      = accuracy;
        rep.verifications = verifications;
        rep.lastUpdated   = uint64(block.timestamp);
        rep.synced        = false; // needs re-sync after update

        emit ReputationUpdated(agent, accuracy, verifications);
    }

    /**
     * @notice Mark agent data as synced to other chains.
     */
    function markSynced(address agent) external onlyAttestor {
        agentReputation[agent].synced = true;
        emit SyncStatusUpdated(agent, true);
    }

    // ─── Claim ───────────────────────────────────────────────────────────────

    /**
     * @notice An agent claims ownership of their Universal Profile by taking
     *         ownership of its LSP6 KeyManager (2-step LSP14 pattern).
     *
     *         Step 1 (this call): Composia-owned KM initiates transferOwnership(agent).
     *         Step 2 (agent): Agent calls KM.acceptOwnership() directly.
     *
     *         After claiming, the agent owns the KM and therefore controls the UP.
     *         Composia retains its LSP6 SETDATA permission on the UP (set at creation)
     *         so it can continue writing gensyn:* reputation data.
     */
    function initiateProfileClaim(address upAddress) external {
        address agent = upToAgent[upAddress];
        require(agent != address(0), "UP not registered");

        address kmAddress = agentToKM[agent];
        require(kmAddress != address(0), "No KeyManager registered");

        // Transfer KeyManager ownership to the claimer (LSP14 2-step)
        (bool ok, ) = kmAddress.call(
            abi.encodeWithSignature("transferOwnership(address)", msg.sender)
        );
        require(ok, "KM transferOwnership failed");

        emit ProfileClaimed(agent, upAddress, msg.sender);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getKeyManager(address agent) external view returns (address) {
        return agentToKM[agent];
    }

    function getAllAgents() external view returns (address[] memory) {
        return _allAgents;
    }

    function agentCount() external view returns (uint256) {
        return _allAgents.length;
    }

    function getAgentData(address agent) external view returns (
        address upAddress,
        address kmAddress,
        uint96  accuracy,
        uint96  verifications,
        uint64  lastUpdated,
        bool    synced,
        uint256 joinedAt
    ) {
        upAddress      = agentToUP[agent];
        kmAddress      = agentToKM[agent];
        ReputationData memory rep = agentReputation[agent];
        accuracy       = rep.accuracy;
        verifications  = rep.verifications;
        lastUpdated    = rep.lastUpdated;
        synced         = rep.synced;
        joinedAt       = agentJoinedAt[agent];
    }

    /**
     * @notice Returns agents with unsynced reputation changes (for batch cross-chain sync).
     */
    function getUnsyncedAgents() external view returns (address[] memory) {
        uint256 count;
        for (uint256 i = 0; i < _allAgents.length; i++) {
            if (!agentReputation[_allAgents[i]].synced) count++;
        }

        address[] memory result = new address[](count);
        uint256 idx;
        for (uint256 i = 0; i < _allAgents.length; i++) {
            if (!agentReputation[_allAgents[i]].synced) {
                result[idx++] = _allAgents[i];
            }
        }
        return result;
    }
}
