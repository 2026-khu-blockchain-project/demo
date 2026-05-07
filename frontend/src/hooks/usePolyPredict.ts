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
import { getBrowserEthereum } from "@/lib/injectedEthereum";

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

function getEnv(): { poly: string; usdc: string; expectedChainId: number | null } {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
  let expectedChainId: number | null = null;
  if (raw && /^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) expectedChainId = n;
  }
  return {
    poly: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() ?? "",
    usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS?.trim() ?? "",
    expectedChainId,
  };
}

/** MetaMask에 네트워크 추가/전환 (Amoy · 로컬 Hardhat) */
async function addOrSwitchChain(eth: Eip1193Provider, chainId: number) {
  const hex = `0x${chainId.toString(16)}`;
  try {
    await eth.request?.({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    return;
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: number }).code : undefined;
    if (code !== 4902) throw e;
  }

  const params =
    chainId === 80002
      ? {
          chainId: hex,
          chainName: "Polygon Amoy",
          nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
          rpcUrls: ["https://rpc-amoy.polygon.technology"],
          blockExplorerUrls: ["https://amoy.polygonscan.com"],
        }
      : chainId === 31337
        ? {
            chainId: hex,
            chainName: "Hardhat Local",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["http://127.0.0.1:8545"],
          }
        : null;

  if (!params) {
    throw new Error(`CHAIN_ID ${chainId}는 자동 추가를 지원하지 않습니다. MetaMask에 수동으로 네트워크를 추가하세요.`);
  }

  await eth.request?.({ method: "wallet_addEthereumChain", params: [params] });
}

export function usePolyPredict() {
  const { poly: polyAddress, usdc: usdcAddress, expectedChainId } = useMemo(() => getEnv(), []);
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
    const eth = getBrowserEthereum();
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
      const msg = e instanceof Error ? e.message : String(e);
      const badCall =
        msg.includes("CALL_EXCEPTION") ||
        msg.includes("missing revert") ||
        msg.includes("BAD_DATA");
      setError(
        badCall
          ? "PolyPredict 주소가 현재 체인과 맞지 않거나, USDC·컨트랙트 주소가 뒤바뀌었을 수 있습니다. `npx hardhat node` 실행 후 프로젝트 루트에서 `npm run deploy:local`로 다시 배포하세요.\n" +
              msg
          : msg
      );
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
    const ethInjected = getBrowserEthereum();
    if (!ethInjected) {
      setError("MetaMask가 필요합니다.");
      return;
    }
    setBusy(true);
    try {
      const eth = ethInjected;
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

  const isWrongNetwork =
    address != null &&
    expectedChainId != null &&
    chainId != null &&
    chainId !== expectedChainId;

  const switchToExpectedNetwork = useCallback(async () => {
    if (expectedChainId == null) return;
    const eth = getBrowserEthereum();
    if (!eth) {
      setError("MetaMask가 필요합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addOrSwitchChain(eth, expectedChainId);
      const provider = new BrowserProvider(eth);
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
      const s = await provider.getSigner();
      setSigner(s);
      setAddress(await s.getAddress());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [expectedChainId]);

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
    expectedChainId,
    isWrongNetwork,
    switchToExpectedNetwork,
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
