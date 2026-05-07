"use client";

import { useCallback, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "ethers";

const DECIMALS = 6;
const MAX_USERS = 10;
const MAX_STAKE = parseUnits("1000", DECIMALS);

type Slot = { yes: bigint; no: bigint; virtualUsdc: bigint };

function emptySlot(): Slot {
  return {
    yes: 0n,
    no: 0n,
    virtualUsdc: parseUnits("50000", DECIMALS),
  };
}

function impliedYesBps(totalYes: bigint, totalNo: bigint): bigint {
  const t = totalYes + totalNo;
  if (t === 0n) return 5000n;
  return (totalYes * 10000n) / t;
}

function multE4(totalYes: bigint, totalNo: bigint, sideYes: boolean): bigint {
  if (sideYes) {
    if (totalYes === 0n) return 0n;
    return ((totalYes + totalNo) * 10000n) / totalYes;
  }
  if (totalNo === 0n) return 0n;
  return ((totalYes + totalNo) * 10000n) / totalNo;
}

export function usePoolMarketDemo() {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: MAX_USERS }, () => emptySlot())
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [outcome, setOutcome] = useState<0 | 1 | 2>(0);
  /** 정산 시점 풀 스냅샷 — 여러 유저 클레임 시 분모 고정 */
  const [snap, setSnap] = useState<{ ty: bigint; tn: bigint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"user" | "owner">("user");

  const totals = useMemo(() => {
    let ty = 0n;
    let tn = 0n;
    for (const s of slots) {
      ty += s.yes;
      tn += s.no;
    }
    return { totalYes: ty, totalNo: tn };
  }, [slots]);

  const participantCount = useMemo(
    () => slots.filter((s) => s.yes + s.no > 0n).length,
    [slots]
  );

  const bps = impliedYesBps(totals.totalYes, totals.totalNo);
  const yesM = multE4(totals.totalYes, totals.totalNo, true);
  const noM = multE4(totals.totalYes, totals.totalNo, false);

  const active = slots[activeIdx] ?? emptySlot();

  const placeBet = useCallback(
    async (yes: boolean, humanAmount: string) => {
      if (resolved) {
        setError("이미 정산됨");
        return;
      }
      setError(null);
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 120));
        const amt = parseUnits(humanAmount || "0", DECIMALS);
        if (amt <= 0n) throw new Error("금액을 입력하세요.");
        const s = slots[activeIdx];
        if (!s) throw new Error("유저 없음");
        const cur = s.yes + s.no;
        if (cur + amt > MAX_STAKE) throw new Error("유저당 최대 1,000 USDC까지.");
        if (s.virtualUsdc < amt) throw new Error("가상 USDC 부족.");

        setSlots((prev) => {
          const next = [...prev];
          const slot = { ...next[activeIdx]! };
          slot.virtualUsdc -= amt;
          if (yes) slot.yes += amt;
          else slot.no += amt;
          next[activeIdx] = slot;
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [activeIdx, resolved, slots]
  );

  const resolveDemo = useCallback(
    async (yesWins: boolean) => {
      if (role !== "owner") {
        setError("관리자 역할로 전환하세요.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await new Promise((r) => setTimeout(r, 150));
        setSnap({ ty: totals.totalYes, tn: totals.totalNo });
        setResolved(true);
        setOutcome(yesWins ? 1 : 2);
      } finally {
        setBusy(false);
      }
    },
    [role, totals.totalNo, totals.totalYes]
  );

  const claimForActive = useCallback(async () => {
    if (!resolved || outcome === 0 || !snap) {
      setError("정산 후에만 가능");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 120));
      const pool = snap.ty + snap.tn;
      const slot = slots[activeIdx];
      if (!slot) throw new Error("유저 없음");
      let payout = 0n;
      if (outcome === 1) {
        if (snap.ty === 0n) throw new Error("YES 풀이 0입니다.");
        if (slot.yes === 0n) throw new Error("YES 쪽에 건 금액이 없습니다.");
        payout = (pool * slot.yes) / snap.ty;
      } else {
        if (snap.tn === 0n) throw new Error("NO 풀이 0입니다.");
        if (slot.no === 0n) throw new Error("NO 쪽에 건 금액이 없습니다.");
        payout = (pool * slot.no) / snap.tn;
      }
      setSlots((prev) => {
        const next = [...prev];
        const n = { ...next[activeIdx]! };
        n.virtualUsdc += payout;
        n.yes = 0n;
        n.no = 0n;
        next[activeIdx] = n;
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [activeIdx, outcome, resolved, slots, snap]);

  const reset = useCallback(() => {
    setSlots(Array.from({ length: MAX_USERS }, () => emptySlot()));
    setResolved(false);
    setOutcome(0);
    setSnap(null);
    setError(null);
    setActiveIdx(0);
    setRole("user");
  }, []);

  return {
    MAX_USERS,
    slots,
    activeIdx,
    setActiveIdx,
    active,
    participantCount,
    totalYes: totals.totalYes,
    totalNo: totals.totalNo,
    impliedYesBps: bps,
    yesMultE4: yesM,
    noMultE4: noM,
    resolved,
    outcome,
    busy,
    error,
    role,
    setRole,
    placeBet,
    resolveDemo,
    claimForActive,
    reset,
    formatUsdc: (v: bigint) => formatUnits(v, DECIMALS),
  };
}
