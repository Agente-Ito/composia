import { expect } from "chai";
import { ethers } from "hardhat";
import { ComposiaRegistry, MockGensyn } from "../typechain-types";

describe("ComposiaRegistry", () => {
  let registry: ComposiaRegistry;
  let mockGensyn: MockGensyn;
  let owner: any, oracle: any, agent1: any, agent2: any, claimant: any;

  const UP_ADDRESS_1 = "0x1111111111111111111111111111111111111111";
  const UP_ADDRESS_2 = "0x2222222222222222222222222222222222222222";
  const KM_ADDRESS_1 = "0x3333333333333333333333333333333333333333";
  const KM_ADDRESS_2 = "0x4444444444444444444444444444444444444444";

  beforeEach(async () => {
    [owner, oracle, agent1, agent2, claimant] = await ethers.getSigners();

    const MockGensyn = await ethers.getContractFactory("MockGensyn");
    mockGensyn = await MockGensyn.deploy(owner.address);

    const ComposiaRegistry = await ethers.getContractFactory("ComposiaRegistry");
    registry = await ComposiaRegistry.deploy(owner.address, oracle.address);
  });

  // ─── registerUP ────────────────────────────────────────────────────────────

  describe("registerUP", () => {
    it("registers an agent→UP mapping", async () => {
      await registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1);
      expect(await registry.agentToUP(agent1.address)).to.equal(UP_ADDRESS_1);
      expect(await registry.upToAgent(UP_ADDRESS_1)).to.equal(agent1.address);
    });

    it("emits ProfileRegistered event", async () => {
      await expect(registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1))
        .to.emit(registry, "ProfileRegistered")
        .withArgs(agent1.address, UP_ADDRESS_1);
    });

    it("reverts if not oracle", async () => {
      await expect(
        registry.connect(agent1).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1)
      ).to.be.revertedWith("Not oracle");
    });

    it("reverts if UP already registered for agent", async () => {
      await registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1);
      await expect(
        registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_2, KM_ADDRESS_2)
      ).to.be.revertedWith("UP already registered");
    });

    it("tracks all agents correctly", async () => {
      await registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1);
      await registry.connect(oracle).registerUP(agent2.address, UP_ADDRESS_2, KM_ADDRESS_2);
      const agents = await registry.getAllAgents();
      expect(agents).to.include(agent1.address);
      expect(agents).to.include(agent2.address);
      expect(await registry.agentCount()).to.equal(2n);
    });
  });

  // ─── updateReputation ──────────────────────────────────────────────────────

  describe("updateReputation", () => {
    beforeEach(async () => {
      await registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1);
    });

    it("updates reputation data", async () => {
      await registry.connect(oracle).updateReputation(agent1.address, 95, 1000);
      const data = await registry.getAgentData(agent1.address);
      expect(data.accuracy).to.equal(95n);
      expect(data.verifications).to.equal(1000n);
      expect(data.synced).to.be.false;
    });

    it("emits ReputationUpdated event", async () => {
      await expect(registry.connect(oracle).updateReputation(agent1.address, 95, 1000))
        .to.emit(registry, "ReputationUpdated")
        .withArgs(agent1.address, 95n, 1000n);
    });

    it("reverts if accuracy > 100", async () => {
      await expect(
        registry.connect(oracle).updateReputation(agent1.address, 101, 100)
      ).to.be.revertedWith("Accuracy must be 0-100");
    });

    it("reverts if agent not registered", async () => {
      await expect(
        registry.connect(oracle).updateReputation(agent2.address, 90, 500)
      ).to.be.revertedWith("Agent not registered");
    });
  });

  // ─── markSynced ────────────────────────────────────────────────────────────

  describe("markSynced", () => {
    it("marks agent as synced and returns them in getUnsyncedAgents before", async () => {
      await registry.connect(oracle).registerUP(agent1.address, UP_ADDRESS_1, KM_ADDRESS_1);
      await registry.connect(oracle).updateReputation(agent1.address, 90, 500);

      let unsynced = await registry.getUnsyncedAgents();
      expect(unsynced).to.include(agent1.address);

      await registry.connect(oracle).markSynced(agent1.address);

      unsynced = await registry.getUnsyncedAgents();
      expect(unsynced).to.not.include(agent1.address);
      expect((await registry.getAgentData(agent1.address)).synced).to.be.true;
    });
  });

  // ─── MockGensyn ────────────────────────────────────────────────────────────

  describe("MockGensyn", () => {
    it("emits VerificationCompleted event", async () => {
      await expect(mockGensyn.simulate(agent1.address, 95, 1000))
        .to.emit(mockGensyn, "VerificationCompleted")
        .withArgs(agent1.address, 95n, 1000n);
    });

    it("reverts with accuracy > 100", async () => {
      await expect(mockGensyn.simulate(agent1.address, 101, 100))
        .to.be.revertedWith("Accuracy must be 0-100");
    });

    it("reverts if not owner", async () => {
      await expect(mockGensyn.connect(agent1).simulate(agent1.address, 90, 100))
        .to.be.revertedWithCustomError(mockGensyn, "OwnableUnauthorizedAccount");
    });

    it("simulateBatch emits multiple events", async () => {
      const tx = mockGensyn.simulateBatch(
        [agent1.address, agent2.address],
        [95, 88],
        [1000, 500]
      );
      await expect(tx)
        .to.emit(mockGensyn, "VerificationCompleted")
        .withArgs(agent1.address, 95n, 1000n);
      await expect(tx)
        .to.emit(mockGensyn, "VerificationCompleted")
        .withArgs(agent2.address, 88n, 500n);
    });
  });
});
