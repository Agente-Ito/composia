"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";

interface Props {
  upAddress: string | null;
}

// LSP11 SocialRecovery factory — not yet deployed on testnet in all environments
// ABI for reading existing recovery contract
const LSP11_ABI = [
  "function getGuardians(address account) view returns (address[])",
  "function getGuardiansThreshold(address account) view returns (uint256)",
  "function addGuardian(address account, address newGuardian) external",
  "function removeGuardian(address account, address existingGuardian) external",
  "function setThreshold(address account, uint256 threshold) external",
];

// ERC725Y key that stores the LSP11 recovery contract address for this UP
const LSP11_DATA_KEY = ethers.keccak256(
  ethers.toUtf8Bytes("LSP11BasicSocialRecovery")
);

const ERC725Y_ABI = [
  "function getData(bytes32 dataKey) view returns (bytes memory)",
];

export default function SocialRecovery({ upAddress }: Props) {
  const { getSigner } = useWallet();
  const [recoveryAddress, setRecoveryAddress] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [newGuardian, setNewGuardian] = useState("");
  const [newThreshold, setNewThreshold] = useState(1);
  const [working, setWorking] = useState(false);

  const loadRecovery = useCallback(async () => {
    if (!upAddress) return;
    setLoading(true);
    try {
      const rpc =
        process.env.NEXT_PUBLIC_LUKSO_RPC ?? "https://rpc.testnet.lukso.network";
      const provider = new ethers.JsonRpcProvider(rpc);
      const up = new ethers.Contract(upAddress, ERC725Y_ABI, provider);

      // Check if a recovery contract is linked
      const raw: string = await up.getData(LSP11_DATA_KEY);
      if (!raw || raw === "0x" || raw.length < 42) {
        setRecoveryAddress(null);
        return;
      }
      const addr = ethers.getAddress("0x" + raw.slice(-40));
      setRecoveryAddress(addr);

      // Load guardians and threshold
      const lsp11 = new ethers.Contract(addr, LSP11_ABI, provider);
      const [gs, th] = await Promise.all([
        lsp11.getGuardians(upAddress),
        lsp11.getGuardiansThreshold(upAddress),
      ]);
      setGuardians(gs as string[]);
      setThreshold(Number(th));
      setNewThreshold(Number(th));
    } catch (err) {
      console.error("LSP11 load error:", err);
    } finally {
      setLoading(false);
    }
  }, [upAddress]);

  useEffect(() => { loadRecovery(); }, [loadRecovery]);

  const addGuardian = async () => {
    if (!recoveryAddress || !upAddress) return;
    if (!ethers.isAddress(newGuardian)) {
      setStatus("Invalid address.");
      return;
    }
    setWorking(true);
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");
      const lsp11 = new ethers.Contract(recoveryAddress, LSP11_ABI, signer);
      const tx = await lsp11.addGuardian(upAddress, newGuardian);
      await tx.wait();
      setNewGuardian("");
      setStatus("Guardian added.");
      await loadRecovery();
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setWorking(false);
    }
  };

  const removeGuardian = async (addr: string) => {
    if (!recoveryAddress || !upAddress) return;
    setWorking(true);
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");
      const lsp11 = new ethers.Contract(recoveryAddress, LSP11_ABI, signer);
      const tx = await lsp11.removeGuardian(upAddress, addr);
      await tx.wait();
      setStatus("Guardian removed.");
      await loadRecovery();
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setWorking(false);
    }
  };

  const updateThreshold = async () => {
    if (!recoveryAddress || !upAddress) return;
    setWorking(true);
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");
      const lsp11 = new ethers.Contract(recoveryAddress, LSP11_ABI, signer);
      const tx = await lsp11.setThreshold(upAddress, newThreshold);
      await tx.wait();
      setThreshold(newThreshold);
      setStatus("Threshold updated.");
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setWorking(false);
    }
  };

  if (!upAddress) {
    return (
      <p className="text-sm" style={{ color: "#4a6670" }}>
        No Universal Profile deployed.
      </p>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      {/* Explainer */}
      <div
        className="rounded-lg p-4 space-y-2"
        style={{ background: " "rgba(123,97,255,$($args[0].Groups[1].Value))" ", border: "1px solid  "rgba(123,97,255,$($args[0].Groups[1].Value))" " }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "#7B61FF" }}>
            LSP11 Social Recovery — unique to LUKSO
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#4a6670" }}>
          If you lose your private key, trusted guardians can vote to restore
          your access. Unlike other chains, this is native to the Universal
          Profile standard — no third-party custodian needed.
        </p>
        <p className="text-xs" style={{ color: "#4a6670" }}>
          <strong style={{ color: "#c8e6ea" }}>How it works:</strong> You set
          M guardians and a threshold N. If N-of-M guardians vote for a new
          recovery address, ownership transfers to that address.
        </p>
      </div>

      {loading ? (
        <div className="text-xs animate-pulse" style={{ color: "#4a6670" }}>
          Checking recovery contract…
        </div>
      ) : !recoveryAddress ? (
        /* Not set up */
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "#4a6670" }}>
            No recovery contract linked to this profile yet.
          </p>
          <a
            href={`https://universalprofile.cloud/address/${upAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg border transition-colors hover:border-composia-cyan/40 hover:text-composia-cyan"
            style={{ borderColor: "#0d1a24", color: "#4a6670" }}
          >
            Set up via UP Cloud ↗
          </a>
          <p className="text-[10px]" style={{ color: "#4a6670" }}>
            Once deployed, come back here to manage guardians and threshold.
          </p>
        </div>
      ) : (
        /* Recovery contract found */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#A78BFA" }} />
            <span className="text-xs font-mono" style={{ color: "#c8e6ea" }}>
              {recoveryAddress.slice(0, 10)}…{recoveryAddress.slice(-6)}
            </span>
          </div>

          {/* Threshold */}
          <div
            className="rounded-lg p-3 flex items-center justify-between"
            style={{ background: "#080b12", border: "1px solid #0d1a24" }}
          >
            <div>
              <div className="text-xs font-medium" style={{ color: "#c8e6ea" }}>
                Threshold
              </div>
              <div className="text-[10px]" style={{ color: "#4a6670" }}>
                {threshold}-of-{guardians.length} guardians required
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.max(guardians.length, 1)}
                value={newThreshold}
                onChange={(e) => setNewThreshold(Number(e.target.value))}
                className="w-14 rounded px-2 py-1 text-sm text-center outline-none"
                style={{ background: "#0d1a24", border: "1px solid #0d1a24", color: "#c8e6ea" }}
              />
              <button
                onClick={updateThreshold}
                disabled={working}
                className="text-[10px] px-2 py-1 rounded border transition-colors hover:border-composia-cyan/40 hover:text-composia-cyan disabled:opacity-50"
                style={{ borderColor: "#0d1a24", color: "#4a6670" }}
              >
                Update
              </button>
            </div>
          </div>

          {/* Guardians list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold" style={{ color: "#c8e6ea" }}>
              Guardians
            </h3>
            {guardians.length === 0 ? (
              <div className="text-xs" style={{ color: "#4a6670" }}>
                No guardians added yet.
              </div>
            ) : (
              guardians.map((g) => (
                <div
                  key={g}
                  className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: "#080b12", border: "1px solid #0d1a24" }}
                >
                  <span className="font-mono text-xs" style={{ color: "#c8e6ea" }}>
                    {g.slice(0, 10)}…{g.slice(-6)}
                  </span>
                  <button
                    onClick={() => removeGuardian(g)}
                    disabled={working}
                    className="text-[10px] px-2 py-0.5 rounded border transition-colors hover:border-red-400/50 hover:text-red-400 disabled:opacity-50"
                    style={{ borderColor: "#0d1a24", color: "#4a6670" }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add guardian */}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg px-3 py-2 text-sm font-mono outline-none"
              style={{ background: "#080b12", border: "1px solid #0d1a24", color: "#c8e6ea" }}
              value={newGuardian}
              onChange={(e) => setNewGuardian(e.target.value)}
              placeholder="0x… guardian address"
            />
            <button
              onClick={addGuardian}
              disabled={working}
              className="text-sm px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ background: "#7B61FF", color: "#000" }}
            >
              {working ? "…" : "Add"}
            </button>
          </div>

          {status && (
            <p
              className="text-xs"
              style={{
                color:
                  status.startsWith("Guardian") || status.startsWith("Threshold")
                    ? "#A78BFA"
                    : "#FF4060",
              }}
            >
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
