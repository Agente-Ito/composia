"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";

interface Props {
  agentAddress: string;
  upAddress: string | null;
  kmAddress: string | null;
}

interface ProfileLink {
  title: string;
  url: string;
}

interface ProfileData {
  name: string;
  description: string;
  profileImage: string;
  links: ProfileLink[];
  userTags: string[];
}

const LSP3_PROFILE_KEY = ethers.keccak256(ethers.toUtf8Bytes("LSP3Profile"));
const LOCKED_TAGS = ["AI Agent", "Gensyn", "CreatedByComposia"];

// Minimal ERC725Y ABI
const ERC725Y_ABI = [
  "function getData(bytes32 dataKey) view returns (bytes memory)",
  "function setDataBatch(bytes32[] memory dataKeys, bytes[] memory dataValues) external",
];

// KeyManager ABI
const KM_ABI = [
  "function execute(bytes calldata payload) external returns (bytes memory)",
];

// VerifiableURI: 0x00006f357c6a (6 bytes) + keccak256(json) (32 bytes) + utf8(url)
function encodeVerifiableURI(json: string): string {
  const jsonBytes = ethers.toUtf8Bytes(json);
  const jsonHash = ethers.keccak256(jsonBytes);
  const prefix = "0x00006f357c6a";
  const dataUri =
    "data:application/json;base64," + btoa(unescape(encodeURIComponent(json)));
  const uriBytes = ethers.hexlify(ethers.toUtf8Bytes(dataUri));
  // concat: prefix(6b) + hash(32b) + uriBytes(no 0x)
  return prefix + jsonHash.slice(2) + uriBytes.slice(2);
}

function decodeVerifiableURI(hex: string): string | null {
  // strip 0x, skip 12 hex chars (6b prefix) + 64 hex chars (32b hash) = 76 chars
  try {
    const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (raw.length < 76) return null;
    const uriHex = raw.slice(76);
    const uri = ethers.toUtf8String("0x" + uriHex);
    if (uri.startsWith("data:application/json;base64,")) {
      const b64 = uri.replace("data:application/json;base64,", "");
      return decodeURIComponent(escape(atob(b64)));
    }
    return uri;
  } catch {
    return null;
  }
}

const EMPTY: ProfileData = {
  name: "",
  description: "",
  profileImage: "",
  links: [],
  userTags: [],
};

export default function ProfileEditor({ agentAddress, upAddress, kmAddress }: Props) {
  const { getSigner } = useWallet();
  const [profile, setProfile] = useState<ProfileData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!upAddress) return;
    setLoading(true);
    try {
      const rpc =
        process.env.NEXT_PUBLIC_LUKSO_RPC ?? "https://rpc.testnet.lukso.network";
      const provider = new ethers.JsonRpcProvider(rpc);
      const up = new ethers.Contract(upAddress, ERC725Y_ABI, provider);
      const raw: string = await up.getData(LSP3_PROFILE_KEY);
      if (!raw || raw === "0x") {
        setProfile({ ...EMPTY, name: `Agent ${agentAddress.slice(0, 6)}` });
        return;
      }
      const json = decodeVerifiableURI(raw);
      if (!json) return;
      const parsed = JSON.parse(json);
      const lsp3 = parsed.LSP3Profile ?? parsed;
      const allTags: string[] = lsp3.tags ?? [];
      const userTags = allTags.filter((t: string) => !LOCKED_TAGS.includes(t));
      setProfile({
        name: lsp3.name ?? "",
        description: lsp3.description ?? "",
        profileImage: lsp3.profileImage?.[0]?.url ?? "",
        links: lsp3.links ?? [],
        userTags,
      });
    } catch (err) {
      console.error("Failed to load LSP3 profile:", err);
    } finally {
      setLoading(false);
    }
  }, [upAddress, agentAddress]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const save = async () => {
    if (!upAddress || !kmAddress) {
      setStatus("UP or KeyManager address missing.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");

      const allTags = [...LOCKED_TAGS, ...profile.userTags];
      const lsp3Json = JSON.stringify({
        LSP3Profile: {
          name: profile.name,
          description: profile.description,
          profileImage: profile.profileImage
            ? [{ width: 0, height: 0, url: profile.profileImage }]
            : [],
          backgroundImage: [],
          links: profile.links,
          tags: allTags,
        },
      });

      const encoded = encodeVerifiableURI(lsp3Json);
      const up = new ethers.Contract(upAddress, ERC725Y_ABI, signer);
      const upIface = new ethers.Interface(ERC725Y_ABI);
      const setDataPayload = upIface.encodeFunctionData("setDataBatch", [
        [LSP3_PROFILE_KEY],
        [encoded],
      ]);

      const km = new ethers.Contract(kmAddress, KM_ABI, signer);
      const tx = await km.execute(setDataPayload);
      await tx.wait();
      setStatus("Profile updated successfully.");
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSaving(false);
    }
  };

  const addLink = () =>
    setProfile((p) => ({ ...p, links: [...p.links, { title: "", url: "" }] }));

  const removeLink = (i: number) =>
    setProfile((p) => ({ ...p, links: p.links.filter((_, idx) => idx !== i) }));

  const updateLink = (i: number, field: "title" | "url", value: string) =>
    setProfile((p) => ({
      ...p,
      links: p.links.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)),
    }));

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || profile.userTags.includes(t) || LOCKED_TAGS.includes(t)) return;
    setProfile((p) => ({ ...p, userTags: [...p.userTags, t] }));
  };

  const removeTag = (tag: string) =>
    setProfile((p) => ({ ...p, userTags: p.userTags.filter((t) => t !== tag) }));

  const inputCls =
    "w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-composia-cyan/50";
  const inputStyle = { background: "#080b12", border: "1px solid #0d1a24", color: "#c8e6ea" };

  if (!upAddress) {
    return (
      <p className="text-sm" style={{ color: "#4a6670" }}>
        No Universal Profile deployed for this agent yet.
      </p>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <p className="text-xs" style={{ color: "#4a6670" }}>
        Writes metadata directly to your Universal Profile on-chain via the KeyManager.
      </p>

      {loading ? (
        <div className="text-xs animate-pulse" style={{ color: "#4a6670" }}>
          Loading profile…
        </div>
      ) : (
        <>
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#c8e6ea" }}>
              Display Name
            </label>
            <input
              className={inputCls}
              style={inputStyle}
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. GnAI-Alpha"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#c8e6ea" }}>
              Description
            </label>
            <textarea
              className={inputCls}
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
              value={profile.description}
              onChange={(e) =>
                setProfile((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="A short bio about this agent…"
            />
          </div>

          {/* Profile image URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "#c8e6ea" }}>
              Profile Image URL
            </label>
            <input
              className={inputCls}
              style={inputStyle}
              value={profile.profileImage}
              onChange={(e) =>
                setProfile((p) => ({ ...p, profileImage: e.target.value }))
              }
              placeholder="https://…"
            />
          </div>

          {/* Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: "#c8e6ea" }}>
                Links
              </label>
              <button
                onClick={addLink}
                className="text-[10px] px-2 py-0.5 rounded border transition-colors hover:border-composia-cyan/40"
                style={{ borderColor: "#0d1a24", color: "#4a6670" }}
              >
                + Add link
              </button>
            </div>
            {profile.links.map((link, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className={inputCls}
                  style={{ ...inputStyle, flex: "1" }}
                  value={link.title}
                  onChange={(e) => updateLink(i, "title", e.target.value)}
                  placeholder="Title"
                />
                <input
                  className={inputCls}
                  style={{ ...inputStyle, flex: "2" }}
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
                  placeholder="https://…"
                />
                <button
                  onClick={() => removeLink(i)}
                  className="text-xs px-2 py-1.5 rounded transition-colors hover:text-red-400"
                  style={{ color: "#4a6670" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: "#c8e6ea" }}>
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {LOCKED_TAGS.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: "rgba(0,212,255,0.2)",
                    color: "#00D4FF",
                    background: "rgba(0,212,255,0.05)",
                  }}
                >
                  🔒 {t}
                </span>
              ))}
              {profile.userTags.map((t) => (
                <button
                  key={t}
                  onClick={() => removeTag(t)}
                  title="Click to remove"
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors hover:border-red-400/50 hover:text-red-400"
                  style={{ borderColor: "#0d1a24", color: "#c8e6ea" }}
                >
                  {t} ✕
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="tag-input"
                className={inputCls}
                style={{ ...inputStyle, flex: "1" }}
                placeholder="Add a tag…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addTag((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById("tag-input") as HTMLInputElement;
                  addTag(input.value);
                  input.value = "";
                }}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-composia-cyan/40 hover:text-composia-cyan"
                style={{ borderColor: "#0d1a24", color: "#4a6670" }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ background: "#00D4FF", color: "#000" }}
            >
              {saving ? "Saving…" : "Save to UP"}
            </button>
            {status && (
              <span
                className="text-xs"
                style={{
                  color: status.startsWith("Profile updated") ? "#00FF88" : "#FF4060",
                }}
              >
                {status}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
