import { ethers } from "ethers";
import { enqueue } from "./queue";

const MOCK_GENSYN_ABI = [
  "event VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)",
];

export class GensynListener {
  private contract: ethers.Contract;
  private provider: ethers.Provider;

  constructor(
    private readonly contractAddress: string,
    provider: ethers.Provider
  ) {
    this.provider = provider;
    this.contract = new ethers.Contract(contractAddress, MOCK_GENSYN_ABI, provider);
  }

  start(): void {
    console.log(`[gensyn-listener] Listening to MockGensyn at ${this.contractAddress}`);

    this.contract.on(
      "VerificationCompleted",
      (agent: string, accuracy: bigint, verifications: bigint) => {
        console.log(
          `[gensyn-listener] Event: agent=${agent} accuracy=${accuracy}% verifications=${verifications}`
        );
        enqueue(agent, Number(accuracy), Number(verifications));
      }
    );

    // Reconnect on provider disconnect
    this.provider.on("error", (err: Error) => {
      console.error("[gensyn-listener] Provider error:", err.message);
    });
  }

  stop(): void {
    this.contract.removeAllListeners();
    console.log("[gensyn-listener] Stopped");
  }
}
