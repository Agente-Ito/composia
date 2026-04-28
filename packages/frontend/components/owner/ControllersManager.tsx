"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";

interface Props {
  upAddress: string | null;
  kmAddress: string | null;
}

interface Controller {
  address: string;
  permissions: string;
  permNames: string[];
}

// LSP6 permission bit names (bit 0 = LSB of bytes32)
// Using number — max bit is 1<<26 = 67M, safely within Number.MAX_SAFE_INTEGER
const PERMISSION_NAMES: [number, string][] = [
  [1 << 0,  "CHANGEOWNER"],
  [1 << 1,  "ADDCONTROLLER"],
  [1 << 2,  "EDITPERMISSIONS"],
  [1 << 3,  "ADDEXTENSIONS"],
  [1 << 4,  "CHANGEEXTENSIONS"],
  [1 << 5,  "ADDUNIVERSALRECEIVERDELEGATE"],
  [1 << 6,  "CHANGEUNIVERSALRECEIVERDELEGATE"],
  [1 << 7,  "REENTRANCY"],
  [1 << 10, "TRANSFERVALUE"],
  [1 << 11, "CALL"],
  [1 << 14, "SETDATA"],
  [1 << 18, "DEPLOY"],
  [1 << 22, "SUPER_TRANSFERVALUE"],
  [1 << 23, "SUPER_CALL"],
  [1 << 26, "SUPER_SETDATA"],
];

// ERC725Y key schema for LSP6 AddressPermissions
const AP_ARRAY_LENGTH_KEY =
  "0xdf30dba06db6a30e65354d9a64c609861f089545ae82db5b58de28d0d95b10f6";

function apElementKey(index: number): string {
  return (
    "0xdf30dba06db6a30e65354d9a64c60986" +
    index.toString(16).padStart(32, "0")
  );
}

function apPermissionsKey(addr: string): string {
  return "0x4b80742de2bf82acb3630000" + addr.slice(2).toLowerCase();
}

function decodePermissions(hex: string): string[] {
  const val = parseInt(hex === "0x" ? "0x0" : hex, 16);
  return PERMISSION_NAMES.filter(([bit]) => (val & bit) !== 0).map(
    ([, name]) => name
  );
}

function encodePermissions(names: string[]): string {
  let val = 0;
  for (const [bit, name] of PERMISSION_NAMES) {
    if (names.includes(name)) val |= bit;
  }
  return ethers.zeroPadValue(ethers.toBeHex(val), 32);
}

const ERC725Y_ABI = [
  "function getData(bytes32 dataKey) view returns (bytes memory)",
  "function setDataBatch(bytes32[] memory dataKeys, bytes[] memory dataValues) external",
];
const KM_ABI = ["function execute(bytes calldata payload) external returns (bytes memory)"];

const COMPOSIA_ADDRESS = (
  process.env.NEXT_PUBLIC_COMPOSIA_ADDRESS ?? ""
).toLowerCase();

export default function ControllersManager({ upAddress, kmAddress }: Props) {
  const { getSigner } = useWallet();
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Add controller form state
  const [newAddr, setNewAddr] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>(["SETDATA", "CALL"]);
  const [preset, setPreset] = useState<string>("app");
  const [showCustom, setShowCustom] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadControllers = useCallback(async () => {
    if (!upAddress) return;
    setLoading(true);
    try {
      const rpc =
        process.env.NEXT_PUBLIC_LUKSO_RPC ?? "https://rpc.testnet.lukso.network";
      const provider = new ethers.JsonRpcProvider(rpc);
      const up = new ethers.Contract(upAddress, ERC725Y_ABI, provider);

      // Read array length (uint128 = 16 bytes, left-padded to 32)
      const lenHex: string = await up.getData(AP_ARRAY_LENGTH_KEY);
      const len = lenHex && lenHex !== "0x" ? Number(BigInt(lenHex)) : 0;

      const result: Controller[] = [];
      for (let i = 0; i < len; i++) {
        const addrHex: string = await up.getData(apElementKey(i));
        if (!addrHex || addrHex === "0x") continue;
        // address stored as 20 bytes right-padded in 32-byte slot
        const addr = ethers.getAddress("0x" + addrHex.slice(-40));
        const permHex: string = await up.getData(apPermissionsKey(addr));
        const permNames = decodePermissions(permHex ?? "0x0");
        result.push({ address: addr, permissions: permHex ?? "0x0", permNames });
      }
      setControllers(result);
    } catch (err) {
      console.error("Failed to load controllers:", err);
    } finally {
      setLoading(false);
    }
  }, [upAddress]);

  useEffect(() => { loadControllers(); }, [loadControllers]);

  const addController = async () => {
    if (!upAddress || !kmAddress) return;
    if (!ethers.isAddress(newAddr)) {
      setStatus("Invalid address");
      return;
    }
    setAdding(true);
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");

      const km = new ethers.Contract(kmAddress, KM_ABI, signer);
      const upIface = new ethers.Interface(ERC725Y_ABI);

      const newLen = controllers.length + 1;
      const newIndex = controllers.length;

      const keys = [
        AP_ARRAY_LENGTH_KEY,
        apElementKey(newIndex),
        apPermissionsKey(newAddr),
      ];
      const values = [
        ethers.zeroPadValue(ethers.toBeHex(newLen), 32),
        ethers.zeroPadValue(newAddr.toLowerCase(), 32),
        encodePermissions(newPerms),
      ];

      const payload = upIface.encodeFunctionData("setDataBatch", [keys, values]);
      const tx = await km.execute(payload);
      await tx.wait();
      setStatus("Controller added.");
      setNewAddr("");
      await loadControllers();
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setAdding(false);
    }
  };

  const revokeController = async (addr: string, index: number) => {
    if (!upAddress || !kmAddress) return;
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");
      const km = new ethers.Contract(kmAddress, KM_ABI, signer);
      const upIface = new ethers.Interface(ERC725Y_ABI);
      const payload = upIface.encodeFunctionData("setDataBatch", [
        [apPermissionsKey(addr)],
        [ethers.zeroPadValue("0x00", 32)],
      ]);
      const tx = await km.execute(payload);
      await tx.wait();
      setStatus(`Revoked permissions for ${addr.slice(0, 6)}…`);
      await loadControllers();
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const PRESETS: {
    id: string;
    label: string;
    perms: string[];
    desc: string;
    warning?: string;
    color: string;
  }[] = [
    {
      id: "metadata",
      label: "Metadata only",
      perms: ["SETDATA"],
      desc: "Can update profile data — name, description, tags. Nothing else.",
      color: "#00FF88",
    },
    {
      id: "app",
      label: "App access",
      perms: ["SETDATA", "CALL"],
      desc: "Typical for dApps: update data and call external contracts (e.g. LSP26 follow, swaps).",
      color: "#00D4FF",
    },
    {
      id: "operator",
      label: "Operator",
      perms: ["SETDATA", "CALL", "TRANSFERVALUE", "DEPLOY"],
      desc: "Can also send LYX and deploy contracts. Suitable for automated bots you trust.",
      warning: "Can move funds from your UP.",
      color: "#FFC033",
    },
    {
      id: "admin",
      label: "Full control",
      perms: PERMISSION_NAMES.map(([, n]) => n),
      desc: "All permissions — same level as you. Use only for another wallet you fully control.",
      warning: "This controller can remove you as owner.",
      color: "#FF4060",
    },
    {
      id: "custom",
      label: "Custom",
      perms: [],
      desc: "Pick individual permissions manually.",
      color: "#4a6670",
    },
  ];

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setShowCustom(id === "custom");
    if (id !== "custom") setNewPerms(p.perms);
  };

  const togglePerm = (name: string) =>
    setNewPerms((p) =>
      p.includes(name) ? p.filter((x) => x !== name) : [...p, name]
    );

  const inputStyle = {
    background: "#080b12",
    border: "1px solid #0d1a24",
    color: "#c8e6ea",
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
      <p className="text-xs" style={{ color: "#4a6670" }}>
        Manage LSP6 KeyManager permissions for controllers of your Universal Profile.
      </p>

      {/* Current controllers */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#c8e6ea" }}>
          Current Controllers
        </h3>
        {loading ? (
          <div className="text-xs animate-pulse" style={{ color: "#4a6670" }}>
            Loading…
          </div>
        ) : controllers.length === 0 ? (
          <div className="text-xs" style={{ color: "#4a6670" }}>
            No controllers found.
          </div>
        ) : (
          controllers.map((ctrl, i) => {
            const isComposiaOracle =
              COMPOSIA_ADDRESS && ctrl.address.toLowerCase() === COMPOSIA_ADDRESS;
            return (
              <div
                key={ctrl.address}
                className="rounded-lg p-3 flex items-start justify-between gap-3"
                style={{ background: "#080b12", border: "1px solid #0d1a24" }}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs break-all" style={{ color: "#c8e6ea" }}>
                      {ctrl.address.slice(0, 10)}…{ctrl.address.slice(-6)}
                    </span>
                    {isComposiaOracle && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded border"
                        style={{
                          borderColor: "rgba(0,212,255,0.25)",
                          color: "#00D4FF",
                          background: "rgba(0,212,255,0.05)",
                        }}
                      >
                        🔒 Composia
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ctrl.permNames.map((p) => (
                      <span
                        key={p}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "#0d1a24", color: "#4a6670" }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                {!isComposiaOracle && (
                  <button
                    onClick={() => revokeController(ctrl.address, i)}
                    className="shrink-0 text-[10px] px-2 py-1 rounded border transition-colors hover:border-red-400/50 hover:text-red-400"
                    style={{ borderColor: "#0d1a24", color: "#4a6670" }}
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add controller */}
      <div className="space-y-3 rounded-lg p-4" style={{ border: "1px solid #0d1a24", background: "#080b12" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#c8e6ea" }}>
          Add Controller
        </h3>
        <input
          className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
          style={inputStyle}
          value={newAddr}
          onChange={(e) => setNewAddr(e.target.value)}
          placeholder="0x… controller address"
        />

        {/* Preset cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className="text-left rounded-lg p-2.5 border transition-colors space-y-1"
              style={{
                borderColor: preset === p.id ? p.color : "#0d1a24",
                background: preset === p.id ? `${p.color}0d` : "transparent",
              }}
            >
              <div className="text-[11px] font-semibold" style={{ color: p.color }}>
                {p.label}
              </div>
              <div className="text-[9px] leading-tight" style={{ color: "#4a6670" }}>
                {p.desc}
              </div>
              {p.warning && preset === p.id && (
                <div className="text-[9px] font-medium" style={{ color: "#FF4060" }}>
                  ⚠ {p.warning}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Custom checkboxes — only shown when preset = custom */}
        {showCustom && (
          <div className="flex flex-wrap gap-2 pt-1">
            {PERMISSION_NAMES.map(([, name]) => (
              <label key={name} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPerms.includes(name)}
                  onChange={() => togglePerm(name)}
                  className="w-3 h-3 accent-composia-cyan"
                />
                <span className="text-[10px] font-mono" style={{ color: "#4a6670" }}>
                  {name}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Summary of selected perms (non-custom) */}
        {!showCustom && newPerms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {newPerms.map((p) => (
              <span
                key={p}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: "#0d1a24", color: "#4a6670" }}
              >
                {p}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={addController}
            disabled={adding}
            className="text-sm px-4 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            style={{ background: "#00D4FF", color: "#000" }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
          {status && (
            <span
              className="text-xs"
              style={{
                color: status.startsWith("Controller") || status.startsWith("Revoked")
                  ? "#00FF88"
                  : "#FF4060",
              }}
            >
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
