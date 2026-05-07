"use client";

import { useCallback, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "ethers";
import type { MarketView } from "./usePolyPredict";

const DECIMALS = 6;

/** 데모용 일반 사용자·관리자 주소 (표시만, 실제 체인 아님) */
export const DEMO_USER = "0x1111222233334444555566667777888899990000";
export const DEMO_OWNER = "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd";

type DemoRole = "user" | "owner";

export function usePolyPredictDemo() {
  const configured = true;
  const polyAddress = "0x000000000000000000000000000000000000dEmo";
  const usdcAddress = "0x000000000000000000000000000000000000dE11";

  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState<DemoRole>("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialDeadline = useMemo(
    () => BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7),
    []
  );

  const [market, setMarket] = useState<MarketView>(() => ({
    question: "바이에른 뮌헨이 2026 UEFA 챔피언스리그에서 우승할까?",
    deadline: initialDeadline,
    state: 0,
    outcome: 0,
    totalCollateral: 0n,
  }));

  const [usdcBal, setUsdcBal] = useState(parseUnits("10000", DECIMALS));
  const [yesBal, setYesBal] = useState(0n);
  const [noBal, setNoBal] = useState(0n);

  const address = connected ? (role === "owner" ? DEMO_OWNER : DEMO_USER) : null;
  const contractOwner = DEMO_OWNER;
  const chainId = 13371337;

  const isOwner =
    address != null && contractOwner.toLowerCase() === address.toLowerCase();

  const refresh = useCallback(async () => {
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      setConnected(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setError(null);
  }, []);

  const approve = useCallback(
    async (humanAmount: string) => {
      setBusy(true);
      setError(null);
      try {
        await new Promise((r) => setTimeout(r, 250));
        parseUnits(humanAmount || "0", DECIMALS);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const mint = useCallback(
    async (humanAmount: string) => {
      if (role !== "user") {
        setError("민트는 일반 사용자 역할에서만 할 수 있습니다.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const amt = parseUnits(humanAmount || "0", DECIMALS);
        if (amt <= 0n) throw new Error("수량을 입력하세요.");
        if (market.state !== 0) throw new Error("시장이 열려 있지 않습니다.");
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (now >= market.deadline) throw new Error("베팅 마감되었습니다.");
        if (usdcBal < amt) throw new Error("USDC 잔고가 부족합니다.");

        await new Promise((r) => setTimeout(r, 400));
        setUsdcBal((b) => b - amt);
        setYesBal((y) => y + amt);
        setNoBal((n) => n + amt);
        setMarket((m) => ({
          ...m,
          totalCollateral: m.totalCollateral + amt,
        }));
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [market.deadline, market.state, refresh, role, usdcBal]
  );

  const resolve = useCallback(
    async (outcome: "YES" | "NO") => {
      if (!isOwner) return;
      setBusy(true);
      setError(null);
      try {
        if (market.state !== 0) throw new Error("이미 정산되었습니다.");
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (now < market.deadline) {
          throw new Error(
            "컨트랙트와 동일하게 마감 시간 이후에만 정산할 수 있습니다. 데모에서는 아래 ‘마감 시각을 지금으로’를 눌러 보세요."
          );
        }
        await new Promise((r) => setTimeout(r, 350));
        const v = outcome === "YES" ? 1 : 2;
        setMarket((m) => ({ ...m, state: 2, outcome: v }));
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [isOwner, market.deadline, market.state, refresh]
  );

  const claim = useCallback(async () => {
    if (role !== "user") {
      setError("클레임은 일반 사용자 역할에서만 할 수 있습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (market.state !== 2) throw new Error("아직 정산되지 않았습니다.");
      const win =
        market.outcome === 1 ? yesBal : market.outcome === 2 ? noBal : 0n;
      if (win <= 0n) throw new Error("받을 당첨 지분이 없습니다.");

      await new Promise((r) => setTimeout(r, 350));
      setUsdcBal((b) => b + win);
      setYesBal(0n);
      setNoBal(0n);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [market.outcome, market.state, noBal, refresh, role, yesBal]);

  /** 데모 전용: 마감을 과거로 돌려 정산 버튼을 시험 */
  const demoSkipDeadline = useCallback(() => {
    setMarket((m) => ({
      ...m,
      deadline: BigInt(Math.floor(Date.now() / 1000) - 60),
    }));
    setError(null);
  }, []);

  const resetDemo = useCallback(() => {
    setMarket({
      question: "바이에른 뮌헨이 2026 UEFA 챔피언스리그에서 우승할까?",
      deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7),
      state: 0,
      outcome: 0,
      totalCollateral: 0n,
    });
    setUsdcBal(parseUnits("10000", DECIMALS));
    setYesBal(0n);
    setNoBal(0n);
    setError(null);
    setRole("user");
  }, []);

  return {
    mode: "demo" as const,
    configured,
    polyAddress,
    usdcAddress,
    connect,
    disconnect,
    busy,
    error,
    address,
    chainId,
    market,
    contractOwner,
    yesBal,
    noBal,
    usdcBal,
    decimals: DECIMALS,
    refresh,
    approve,
    mint,
    resolve,
    claim,
    isOwner,
    formatUsdc: (v: bigint) => formatUnits(v, DECIMALS),
    role,
    setRole,
    demoSkipDeadline,
    resetDemo,
  };
}
