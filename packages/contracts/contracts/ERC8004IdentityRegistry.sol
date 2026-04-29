// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ERC8004IdentityRegistry
 * @notice Minimal ERC-8004 "Trustless Agents" Identity Registry.
 *         Implements the Identity Registry portion of ERC-8004 (https://eips.ethereum.org/EIPS/eip-8004).
 *
 *         Each registered agent gets an ERC-721 token (agentId) whose tokenURI resolves
 *         to the agent's registration file (the ERC-8004 §registration-v1 JSON).
 *
 *         The registration file is served by Composia at:
 *           https://composia.app/api/agent/{address}/erc8004
 *
 *         Agents self-register — Composia does not custody agentIds.
 *         Gas is paid by the registering agent.
 */
contract ERC8004IdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextAgentId = 1;

    /// agentId → wallet that registered (initial owner)
    mapping(uint256 => address) public agentWallet;

    /// address → agentId (0 = not registered)
    mapping(address => uint256) public addressToAgentId;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    constructor() ERC721("ERC-8004 Agent", "AGENT") Ownable(msg.sender) {}

    /**
     * @notice Register a new agent and mint its ERC-721 identity token.
     * @param agentURI URI of the ERC-8004 §registration-v1 JSON file.
     * @return agentId The minted token id.
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        agentWallet[agentId] = msg.sender;
        addressToAgentId[msg.sender] = agentId;
        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Update the agentURI (registration file pointer).
     *         Only the token owner or an approved operator may call this.
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(
            ownerOf(agentId) == msg.sender || isApprovedForAll(ownerOf(agentId), msg.sender),
            "Not owner or operator"
        );
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Convenience getter — returns agentId for a given address (0 = not registered).
     */
    function getAgentId(address agent) external view returns (uint256) {
        return addressToAgentId[agent];
    }

    /**
     * @notice Total number of registered agents.
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }
}
