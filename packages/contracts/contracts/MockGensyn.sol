// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockGensyn
 * @notice Emulates Gensyn rollup events for hackathon demo purposes.
 *         In production this would be the real Gensyn rollup contract.
 */
contract MockGensyn is Ownable {
    event VerificationCompleted(
        address indexed agent,
        uint256 accuracy,      // 0-100
        uint256 verifications  // total count
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function simulate(
        address agent,
        uint256 accuracy,
        uint256 verifications
    ) external onlyOwner {
        require(accuracy <= 100, "Accuracy must be 0-100");
        require(agent != address(0), "Invalid agent address");
        emit VerificationCompleted(agent, accuracy, verifications);
    }

    /// Batch simulate multiple agents at once (useful for demo setup)
    function simulateBatch(
        address[] calldata agents,
        uint256[] calldata accuracies,
        uint256[] calldata verificationCounts
    ) external onlyOwner {
        require(
            agents.length == accuracies.length &&
            agents.length == verificationCounts.length,
            "Array length mismatch"
        );
        for (uint256 i = 0; i < agents.length; i++) {
            emit VerificationCompleted(agents[i], accuracies[i], verificationCounts[i]);
        }
    }
}
