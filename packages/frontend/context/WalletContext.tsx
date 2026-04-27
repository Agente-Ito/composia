"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { ethers } from "ethers";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

interface WalletCtx {
  address: string | null;
  chainId: number | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  getSigner: () => Promise<ethers.Signer | null>;
  error: string | null;
}

const WalletContext = createContext<WalletCtx>({
  address: null,
  chainId: null,
  connected: false,
  connect: async () => {},
  disconnect: () => {},
  getSigner: async () => null,
  error: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts[0]) {
          setAddress(accounts[0]);
          window.ethereum
            .request({ method: "eth_chainId" })
            .then((hex: string) => setChainId(parseInt(hex, 16)));
        }
      })
      .catch(() => {});
  }, []);

  // Listen for wallet events
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const onAccounts = (accounts: string[]) =>
      setAddress(accounts[0] ?? null);
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError(
        "No wallet found. Install MetaMask or the LUKSO Universal Profile extension."
      );
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const network = await provider.getNetwork();
      setAddress(addr);
      setChainId(Number(network.chainId));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (typeof window === "undefined" || !window.ethereum || !address)
      return null;
    try {
      return (new ethers.BrowserProvider(window.ethereum)).getSigner();
    } catch {
      return null;
    }
  }, [address]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        connected: !!address,
        connect,
        disconnect,
        getSigner,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
