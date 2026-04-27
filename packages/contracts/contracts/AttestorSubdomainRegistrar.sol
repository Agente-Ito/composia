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
 *         Called by the Composia listener after creating a Lukso Universal Profile.
 *
 * Setup:
 *   1. Deploy this contract
 *   2. deployer calls NameWrapper.setApprovalForAll(address(this), true)
 *   3. Now this contract can create subdomains under composia.eth
 */
contract AttestorSubdomainRegistrar is Ownable {
    INameWrapper    public immutable nameWrapper;
    IPublicResolver public immutable resolver;
    bytes32         public immutable parentNode; // namehash("composia.eth")

    event SubdomainRegistered(bytes32 indexed node, string label, address agentEoa);
    event TextRecordsUpdated(bytes32 indexed node);

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

    /**
     * @notice Create a subdomain for an agent and write all text records in one tx.
     * @param label    The subdomain label (e.g. first 8 hex chars of the agent EOA)
     * @param agentEoa Agent's Ethereum address — written as addr(60) coin type
     * @param keys     Text record keys (e.g. "gensyn:accuracy")
     * @param values   Text record values (same length as keys)
     */
    function registerSubdomain(
        string   calldata label,
        address           agentEoa,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwner returns (bytes32 node) {
        require(keys.length == values.length, "Keys/values length mismatch");

        // Create the subdomain — owner = this contract so we can write text records
        node = nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            address(this), // registrar owns subnode → can write to resolver
            address(resolver),
            0,             // ttl
            0,             // fuses: none for MVP (identity anchor via text records)
            0              // expiry: inherit parent
        );

        // Write text records
        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
        }

        // Write ETH address as multi-coin addr(60)
        resolver.setAddr(node, 60, abi.encodePacked(agentEoa));

        emit SubdomainRegistered(node, label, agentEoa);
    }

    /**
     * @notice Update text records for an existing subdomain (e.g. after reputation update).
     */
    function updateTextRecords(
        bytes32  node,
        string[] calldata keys,
        string[] calldata values
    ) external onlyOwner {
        require(keys.length == values.length, "Keys/values length mismatch");
        for (uint256 i = 0; i < keys.length; i++) {
            resolver.setText(node, keys[i], values[i]);
        }
        emit TextRecordsUpdated(node);
    }
}
