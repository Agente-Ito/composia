import { expect } from "chai";
import { ethers } from "hardhat";
import { SyncerContract } from "../typechain-types";

describe("SyncerContract", () => {
  let syncer: SyncerContract;
  let owner: any, relayer: any, agent1: any, agent2: any;

  beforeEach(async () => {
    [owner, relayer, agent1, agent2] = await ethers.getSigners();
    const SyncerContract = await ethers.getContractFactory("SyncerContract");
    syncer = await SyncerContract.deploy(owner.address, relayer.address, "lukso-testnet");
  });

  it("stores reputation after receiveMessage", async () => {
    await syncer.connect(relayer).receiveMessage(agent1.address, 95, 1000);
    const [acc, verifs] = await syncer.getReputation(agent1.address);
    expect(acc).to.equal(95n);
    expect(verifs).to.equal(1000n);
  });

  it("emits ReputationReceived", async () => {
    await expect(syncer.connect(relayer).receiveMessage(agent1.address, 95, 1000))
      .to.emit(syncer, "ReputationReceived")
      .withArgs(agent1.address, 95n, 1000n);
  });

  it("reverts if not relayer", async () => {
    await expect(syncer.connect(agent1).receiveMessage(agent1.address, 90, 500))
      .to.be.revertedWith("Not relayer");
  });

  it("processes batch correctly", async () => {
    await syncer.connect(relayer).receiveBatch(
      [agent1.address, agent2.address],
      [95, 88],
      [1000, 500]
    );
    const [acc1] = await syncer.getReputation(agent1.address);
    const [acc2] = await syncer.getReputation(agent2.address);
    expect(acc1).to.equal(95n);
    expect(acc2).to.equal(88n);

    const agents = await syncer.getAllAgents();
    expect(agents.length).to.equal(2);
  });
});
