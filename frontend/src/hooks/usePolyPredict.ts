"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits,
  type Eip1193Provider,
  type Signer,
} from "ethers";
import { PolyPredictAbi } from "@/abis/PolyPredict";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

export type MarketView = {
  question: string;
  deadline: bigint;
  state: number;
  outcome: number;
  totalCollateral: bigint;
};

function getEnv(): { poly: string; usdc: string } {
  return {
    poly: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() ?? "",
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS?.trim() ?? "",
  };
}

export function usePolyPredict() {
  const { poly: polyAddress, usdc: usdcAddress } = useMemo(() => getEnv(), []);
  const configured = Boolean(polyAddress && usdcAddress);

  const [signer, setSigner] = useState<Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketView | null>(null);
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [yesBal, setYesBal] = useState<bigint>(0n);
  const [noBal, setNoBal] = useState<bigint>(0n);
  const [usdcBal, setUsdcBal] = useState<bigint>(0n);
  const [decimals, setDecimals] = useState(6);

  const poly = useMemo(
    () => (signer && polyAddress ? new Contract(polyAddress, PolyPredictAbi, signer) : null),
    [signer, polyAddress]
  );
  const usdc = useMemo(
    () => (signer && usdcAddress ? new Contract(usdcAddress, ERC20_ABI, signer) : null),
    [signer, usdcAddress]
  );

  const refresh = useCallback(async () => {
    if (!configured || !polyAddress || !usdcAddress) return;
    const eth = typeof window !== "undefined"
      ? (window as unknown as { ethereum?: Eip1193Provider }).ethereum
      : undefined;
    if (!eth) return;

    setError(null);
    try {
      const provider = new BrowserProvider(eth);
      const polyRead = new Contract(polyAddress, PolyPredictAbi, provider);
      const m = await polyRead.getMarket(0n);
      setContractOwner(await polyRead.owner());
      setMarket({
        question: m.question,
        deadline: m.deadline,
        state: Number(m.state),
        outcome: Number(m.outcome),
        totalCollateral: m.totalCollateral,
      });

      const usdcRead = new Contract(usdcAddress, ERC20_ABI, provider);
      setDecimals(Number(await usdcRead.decimals()));

      if (address) {
        const [y, n] = await polyRead.getShareBalances(0n, address);
        setYesBal(y);
        setNoBal(n);
        setUsdcBal(await usdcRead.balanceOf(address));
      } else {
        setYesBal(0n);
        setNoBal(0n);
        setUsdcBal(0n);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [address, configured, polyAddress, usdcAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    if (!configured) {
      setError("NEXT_PUBLIC_CONTRACT_ADDRESS / NEXT_PUBLIC_USDC_ADDRESS를 설정하세요.");
      return;
    }
    if (typeof window === "undefined" || !(window as unknown as { ethereum?: unknown }).ethereum) {
      setError("MetaMask가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const eth = (window as unknown as { ethereum: Eip1193Provider }).ethereum;
      const provider = new BrowserProvider(eth);
      await provider.send("eth_requestAccounts", []);
      const s = await provider.getSigner();
      const net = await provider.getNetwork();
      setSigner(s);
      setAddress(await s.getAddress());
      setChainId(Number(net.chainId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [configured]);

  const approve = useCallback(
    async (humanAmount: string) => {
      if (!poly || !usdc || !polyAddress || !address) return;
      setBusy(true);
      setError(null);
      try {
        const d = Number(await usdc.decimals());
        const amt = parseUnits(humanAmount || "0", d);
        const tx = await usdc.approve(polyAddress, amt);
        await tx.wait();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [poly, polyAddress, refresh, usdc, address]
  );

  const mint = useCallback(
    async (humanAmount: string) => {
      if (!poly || !address) return;
      setBusy(true);
      setError(null);
      try {
        const amt = parseUnits(humanAmount || "0", decimals);
        const tx = await poly.mintShares(0n, amt);
        await tx.wait();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [decimals, poly, refresh]
  );

  const resolve = useCallback(
    async (outcome: "YES" | "NO") => {
      if (!poly) return;
      setBusy(true);
      setError(null);
      try {
        const v = outcome === "YES" ? 1 : 2;
        const tx = await poly.resolveMarket(0n, v);
        await tx.wait();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [poly, refresh]
  );

  const claim = useCallback(async () => {
    if (!poly) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await poly.claimWinnings(0n);
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [poly, refresh]);

  const isOwner =
    address != null &&
    contractOwner != null &&
    contractOwner.toLowerCase() === address.toLowerCase();

  return {
    mode: "chain" as const,
    configured,
    polyAddress,
    usdcAddress,
    connect,
    busy,
    error,
    address,
    chainId,
    market,
    contractOwner,
    yesBal,
    noBal,
    usdcBal,
    decimals,
    refresh,
    approve,
    mint,
    resolve,
    claim,
    isOwner,
    formatUsdc: (v: bigint) => formatUnits(v, decimals),
  };
}
