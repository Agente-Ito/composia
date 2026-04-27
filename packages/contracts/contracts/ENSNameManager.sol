// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAttestorSubdomainRegistrar {
    function registerSubdomain(
        string   calldata label,
        address           agentEoa,
        string[] calldata keys,
        string[] calldata values
    ) external returns (bytes32 node);
}

interface IReputationState {
    function agentToNode(address agent) external view returns (bytes32);
    function agentToUP(address agent) external view returns (address);
    function addENSLabel(address agent, string calldata label) external;
}

/**
 * @title ENSNameManager
 * @notice 2-tier ENS name system for Composia agents.
 *
 * Tier 1 — Auto-generated (immediate, created when UP is made):
 *   {first8hexOfEOA}.composia.eth   e.g. b95b88c2.composia.eth
 *
 * Tier 2 — Custom name (agent chooses, after claiming their UP):
 *   {customLabel}.composia.eth      e.g. alice.composia.eth
 *
 * An agent can have multiple names — all resolve to the same profile.
 * The agent picks a "primary name" shown in the UI (defaults to custom if set).
 *
 * How to set a custom name:
 *   1. Agent claims UP ownership on Lukso
 *   2. Oracle registers agent in ReputationState (registerAgent)
 *   3. Agent calls ENSNameManager.setCustomName("alice") from their EOA
 *   4. ENSNameManager verifies via ReputationState, creates subdomain, updates state
 */
contract ENSNameManager is Ownable {

    IAttestorSubdomainRegistrar public registrar;
    IReputationState            public reputationState;

    uint256 public constant MIN_LABEL_LEN = 3;
    uint256 public constant MAX_LABEL_LEN = 32;

    // Custom label state
    mapping(string  => bool)    public customLabelUsed;     // label → taken?
    mapping(string  => address) public customLabelToAgent;  // label → agent EOA
    mapping(address => string)  public primaryLabel;        // agent → preferred label (custom)

    event CustomNameSet(address indexed agent, string label, string ensName);
    event PrimaryNameChanged(address indexed agent, string newLabel);

    constructor(
        address initialOwner,
        address _registrar,
        address _reputationState
    ) Ownable(initialOwner) {
        registrar      = IAttestorSubdomainRegistrar(_registrar);
        reputationState = IReputationState(_reputationState);
    }

    // ── Agent-callable functions ──────────────────────────────────────────────

    /**
     * @notice Register a custom ENS label for the caller's agent identity.
     *         Requires the caller to be a registered agent in ReputationState.
     *         The deployer pays ENS gas via the Registrar (Composia sponsors this).
     *
     * @param label  Lowercase alphanumeric label, 3–32 chars, no leading/trailing dash.
     *               Example: "alice" → creates alice.composia.eth
     */
    function setCustomName(string calldata label) external {
        address agent = msg.sender;

        // Must be a registered Composia agent
        require(reputationState.agentToNode(agent) != bytes32(0), "Not a registered agent");

        // Validate format
        require(_isValidLabel(label), "Invalid label: 3-32 lowercase alphanumeric/dash, no leading/trailing dash");

        // Must not be taken
        require(!customLabelUsed[label], "Label already taken");

        // Create the ENS subdomain via Registrar (authorized caller)
        address upAddress = reputationState.agentToUP(agent);
        string[] memory keys   = new string[](2);
        string[] memory values = new string[](2);
        keys[0]   = "gensyn:agent_address";
        values[0] = _toHexString(agent);
        keys[1]   = "gensyn:up_address";
        values[1] = _toHexString(upAddress);

        registrar.registerSubdomain(label, agent, keys, values);

        // Update state
        customLabelUsed[label]     = true;
        customLabelToAgent[label]  = agent;
        primaryLabel[agent]        = label; // custom becomes primary automatically

        // Notify ReputationState (for bidirectional lookup)
        reputationState.addENSLabel(agent, label);

        string memory fullName = string.concat(label, ".composia.eth");
        emit CustomNameSet(agent, label, fullName);
        emit PrimaryNameChanged(agent, label);
    }

    /**
     * @notice Switch which label is shown as the agent's primary name.
     *         The custom label must already be registered to the caller.
     */
    function setPrimaryLabel(string calldata label) external {
        require(customLabelToAgent[label] == msg.sender, "Not your label");
        primaryLabel[msg.sender] = label;
        emit PrimaryNameChanged(msg.sender, label);
    }

    /**
     * @notice Clear custom primary → fall back to auto-generated name.
     */
    function clearPrimaryLabel() external {
        delete primaryLabel[msg.sender];
        emit PrimaryNameChanged(msg.sender, _autoLabel(msg.sender));
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns the full ENS name the agent prefers to share.
     *         Falls back to auto-generated label if no custom name is set.
     */
    function getPrimaryName(address agent) external view returns (string memory) {
        string memory label = primaryLabel[agent];
        if (bytes(label).length == 0) label = _autoLabel(agent);
        return string.concat(label, ".composia.eth");
    }

    /**
     * @notice Returns just the label portion of the primary name (without .composia.eth).
     */
    function getPrimaryLabel(address agent) external view returns (string memory) {
        string memory label = primaryLabel[agent];
        return bytes(label).length > 0 ? label : _autoLabel(agent);
    }

    /**
     * @notice Check if a custom label is available for registration.
     *         Returns false if the label is taken or has an invalid format.
     */
    function isLabelAvailable(string calldata label) external view returns (bool) {
        return _isValidLabel(label) && !customLabelUsed[label];
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _autoLabel(address agent) internal pure returns (string memory) {
        // Matches ens-registrar.ts: first 8 hex chars of the EOA (without 0x prefix)
        bytes memory addr = abi.encodePacked(agent);
        bytes memory result = new bytes(8);
        bytes16 hex_ = "0123456789abcdef";
        for (uint256 i = 0; i < 4; i++) {
            result[i * 2]     = hex_[uint8(addr[i]) >> 4];
            result[i * 2 + 1] = hex_[uint8(addr[i]) & 0x0f];
        }
        return string(result);
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory b = abi.encodePacked(addr);
        bytes memory s = new bytes(42);
        s[0] = '0'; s[1] = 'x';
        bytes16 hex_ = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            s[2 + i * 2]     = hex_[uint8(b[i]) >> 4];
            s[2 + i * 2 + 1] = hex_[uint8(b[i]) & 0x0f];
        }
        return string(s);
    }

    function _isValidLabel(string memory label) internal pure returns (bool) {
        bytes memory b = bytes(label);
        uint256 len = b.length;
        if (len < MIN_LABEL_LEN || len > MAX_LABEL_LEN) return false;
        if (b[0] == '-' || b[len - 1] == '-') return false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || c == '-';
            if (!ok) return false;
        }
        return true;
    }
}
