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
import { PoolBinaryMarketAbi } from "@/abis/PoolBinaryMarket";
import { getBrowserEthereum } from "@/lib/injectedEthereum";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

function getEnv() {
  const pool = process.env.NEXT_PUBLIC_POOL_MARKET_ADDRESS?.trim() ?? "";
  const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS?.trim() ?? "";
  const rawChain = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
  let expectedChainId: number | null = null;
  if (rawChain && /^\d+$/.test(rawChain)) {
    const n = Number.parseInt(rawChain, 10);
    if (Number.isFinite(n)) expectedChainId = n;
  }
  return { pool, usdc, expectedChainId };
}

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
  if (!params) throw new Error(`CHAIN_ID ${chainId} 자동 추가 미지원`);
  await eth.request?.({ method: "wallet_addEthereumChain", params: [params] });
}

export function usePoolMarket() {
  const { pool: poolAddress, usdc: usdcAddress, expectedChainId } = useMemo(() => getEnv(), []);
  const configured = Boolean(poolAddress && usdcAddress);

  const [signer, setSigner] = useState<Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalYes, setTotalYes] = useState(0n);
  const [totalNo, setTotalNo] = useState(0n);
  const [impliedYesBps, setImpliedYesBps] = useState(5000n);
  const [yesMultE4, setYesMultE4] = useState(0n);
  const [noMultE4, setNoMultE4] = useState(0n);
  const [outcome, setOutcome] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [participants, setParticipants] = useState(0n);
  const [sideYesOnlyCount, setSideYesOnlyCount] = useState(0);
  const [sideNoOnlyCount, setSideNoOnlyCount] = useState(0);
  const [myYes, setMyYes] = useState(0n);
  const [myNo, setMyNo] = useState(0n);
  const [usdcBal, setUsdcBal] = useState(0n);
  const [decimals, setDecimals] = useState(6);
  const [owner, setOwner] = useState<string | null>(null);

  const pool = useMemo(
    () => (signer && poolAddress ? new Contract(poolAddress, PoolBinaryMarketAbi, signer) : null),
    [signer, poolAddress]
  );
  const usdc = useMemo(
    () => (signer && usdcAddress ? new Contract(usdcAddress, ERC20_ABI, signer) : null),
    [signer, usdcAddress]
  );

  const refresh = useCallback(async () => {
    if (!configured || !poolAddress || !usdcAddress) return;
    const eth = getBrowserEthereum();
    if (!eth) return;
    setError(null);
    try {
      const provider = new BrowserProvider(eth);
      const read = new Contract(poolAddress, PoolBinaryMarketAbi, provider);
      setTotalYes(await read.totalYes());
      setTotalNo(await read.totalNo());
      setImpliedYesBps(await read.impliedYesBps());
      setYesMultE4(await read.yesPoolMultiplierE4());
      setNoMultE4(await read.noPoolMultiplierE4());
      setOutcome(Number(await read.outcome()));
      setResolved(await read.resolved());
      const pc: bigint = await read.participantCount();
      setParticipants(pc);
      let yc = 0;
      let nc = 0;
      const n = Number(pc);
      for (let i = 0; i < n; i++) {
        const addr: string = await read.participantAt(i);
        const y: bigint = await read.yesOf(addr);
        const noAmt: bigint = await read.noOf(addr);
        if (y > 0n && noAmt === 0n) yc++;
        else if (noAmt > 0n && y === 0n) nc++;
      }
      setSideYesOnlyCount(yc);
      setSideNoOnlyCount(nc);
      setOwner(await read.owner());

      const usdcRead = new Contract(usdcAddress, ERC20_ABI, provider);
      setDecimals(Number(await usdcRead.decimals()));

      if (address) {
        setMyYes(await read.yesOf(address));
        setMyNo(await read.noOf(address));
        setUsdcBal(await usdcRead.balanceOf(address));
      } else {
        setMyYes(0n);
        setMyNo(0n);
        setUsdcBal(0n);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [address, configured, poolAddress, usdcAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    if (!configured) {
      setError("NEXT_PUBLIC_POOL_MARKET_ADDRESS / NEXT_PUBLIC_USDC_ADDRESS를 설정하세요.");
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
      if (!pool || !usdc || !poolAddress || !address) return;
      setBusy(true);
      setError(null);
      try {
        const d = Number(await usdc.decimals());
        const amt = parseUnits(humanAmount || "0", d);
        const tx = await usdc.approve(poolAddress, amt);
        await tx.wait();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [address, pool, poolAddress, refresh, usdc]
  );

  const placeBet = useCallback(
    async (yes: boolean, humanAmount: string) => {
      if (!pool || !address) return;
      setBusy(true);
      setError(null);
      try {
        const amt = parseUnits(humanAmount || "0", decimals);
        const tx = await pool.placeBet(yes, amt);
        await tx.wait();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [address, decimals, pool, refresh]
  );

  const resolve = useCallback(
    async (yesWins: boolean) => {
      if (!pool) return;
      setBusy(true);
      setError(null);
      try {
        const v = yesWins ? 1 : 2;
        const tx = await pool.resolve(v);
        await tx.wait();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [pool, refresh]
  );

  const claim = useCallback(async () => {
    if (!pool) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await pool.claim();
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pool, refresh]);

  const isOwner =
    address != null && owner != null && owner.toLowerCase() === address.toLowerCase();

  return {
    configured,
    poolAddress,
    usdcAddress,
    expectedChainId,
    isWrongNetwork,
    switchToExpectedNetwork,
    connect,
    busy,
    error,
    address,
    chainId,
    totalYes,
    totalNo,
    impliedYesBps,
    yesMultE4,
    noMultE4,
    outcome,
    resolved,
    participants,
    sideYesOnlyCount,
    sideNoOnlyCount,
    myYes,
    myNo,
    usdcBal,
    decimals,
    owner,
    isOwner,
    refresh,
    approve,
    placeBet,
    resolve,
    claim,
    formatUsdc: (v: bigint) => formatUnits(v, decimals),
  };
}
