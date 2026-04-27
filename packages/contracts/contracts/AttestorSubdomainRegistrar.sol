// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string  calldata label,
        address owner,
        address resolver,
        uint64  ttl,
        uint32  fuses,
        uint64  expiry
    ) external returns (bytes32 node);
}

interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external;
}

/**
 * @title AttestorSubdomainRegistrar
 * @notice Creates {label}.composia.eth subdomains on Ethereum Sepolia for Gensyn agents.
 *
 * Callers:
 *   - Owner (deployer / oracle): auto-generated names, text record updates
 *   - ENSNameManager (authorized): custom names requested by agents
 *
 * Setup:
 *   1. Deploy this contract
 *   2. deployer calls NameWrapper.setApprovalForAll(address(this), true)
 *   3. deployer calls setAuthorized(ENSNameManager, true)
 */
contract AttestorSubdomainRegistrar is Ownable {
    INameWrapper    public immutable nameWrapper;
    IPublicResolver public immutable resolver;
    bytes32         public immutable parentNode;

    // Contracts that are allowed to call registerSubdomain (e.g. ENSNameManager)
    mapping(address => bool) public authorized;

    event SubdomainRegistered(bytes32 indexed node, string label, address agentEoa);
    event TextRecordsUpdated(bytes32 indexed node);
    event AuthorizationChanged(address indexed caller, bool ok);

    modifier onlyOwnerOrAuthorized() {
        require(msg.sender == owner() || authorized[msg.sender], "Not authorized");
        _;
    }

    constructor(
        address initialOwner,
        address _nameWrapper,
        address _resolver,
        bytes32 _parentNode
    ) Ownable(initialOwner) {
        nameWrapper = INameWrapper(_nameWrapper);
        resolver    = IPublicResolver(_resolver);
        parentNode  = _parentNode;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setAuthorized(address caller, bool ok) external onlyOwner {
        authorized[caller] = ok;
        emit AuthorizationChanged(caller, ok);
    }

    // ── Core operations ───────────────────────────────────────────────────────

    /**
     * @notice Create a subdomain and write all text records in one transaction.
     * @param label    Subdomain label (auto-generated or custom)
     * @param agentEoa Agent's Ethereum EOA — written as addr(60) coin type
     * @param keys     Text record keys
     * @param values   Text record values (same length as keys)
     */
    function registerSubdomain(
        string   calldata label,
        address           agentEoa,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwnerOrAuthorized returns (bytes32 node) {
        require(keys.length == values.length, "Keys/values length mismatch");

        node = nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            address(this),
            address(resolver),
            0, 0, 0
        );

        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
        }

        resolver.setAddr(node, 60, abi.encodePacked(agentEoa));

        emit SubdomainRegistered(node, label, agentEoa);
    }

    /**
     * @notice Update text records for an existing subdomain.
     */
    function updateTextRecords(
        bytes32  node,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwnerOrAuthorized {
        require(keys.length == values.length, "Keys/values length mismatch");
        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
        }
        emit TextRecordsUpdated(node);
    }
}
