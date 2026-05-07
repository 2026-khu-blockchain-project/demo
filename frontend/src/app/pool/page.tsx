"use client";

import Link from "next/link";
import { useState } from "react";
import { usePoolMarket } from "@/hooks/usePoolMarket";
import { usePoolMarketDemo } from "@/hooks/usePoolMarketDemo";

const QUESTION = "바이에른 뮌헨이 2026 UEFA 챔피언스리그에서 우승할까?";

const demoOnly =
  process.env.NEXT_PUBLIC_DEMO_ONLY === "1" ||
  process.env.NEXT_PUBLIC_DEMO_ONLY === "true";

function PoolBar({ yes, no }: { yes: bigint; no: bigint }) {
  const t = yes + no;
  const yPct = t === 0n ? 50 : Number((yes * 100n) / t);
  const nPct = 100 - yPct;
  return (
    <div className="pool-wrap">
      <div className="pool-bar2">
        <div className="pool-yes2" style={{ width: `${yPct}%` }} title="YES 풀" />
        <div className="pool-no2" style={{ width: `${nPct}%` }} title="NO 풀" />
      </div>
      <div className="pool-legend2">
        <span>YES 약 {yPct.toFixed(1)}%</span>
        <span>NO 약 {nPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default function PoolPage() {
  const chain = usePoolMarket();
  const demo = usePoolMarketDemo();
  const [mode, setMode] = useState<"chain" | "demo">(
    demoOnly ? "demo" : chain.configured ? "chain" : "demo"
  );
  const activeMode = demoOnly ? "demo" : mode;

  const [betAmt, setBetAmt] = useState("50");
  const [approveAmt, setApproveAmt] = useState("2000");

  const wrongChain = Boolean(
    !demoOnly && activeMode === "chain" && chain.address && chain.isWrongNetwork
  );

  if (activeMode === "demo") {
    const bps = demo.impliedYesBps;
    const pYes = Number(bps) / 100;

    return (
      <div className="app pool-page">
        <nav className="subnav">
          <Link href="/">← LP 예측 시장</Link>
        </nav>

        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden />
            <div>
              <h1>풀 배팅 마켓</h1>
              <p className="brand-tag">최대 10명 · 유저당 최대 1,000 USDC · Pot 비율 → 확률·배당</p>
            </div>
          </div>
          {demoOnly && <span className="pill-env">연습</span>}
        </header>

        {!demoOnly && (
          <div className="segment" style={{ marginBottom: "1rem" }}>
            <button type="button" className={mode === "chain" ? "seg on" : "seg"} disabled={!chain.configured} onClick={() => setMode("chain")}>
              지갑 연결
            </button>
            <button type="button" className={mode === "demo" ? "seg on" : "seg"} onClick={() => setMode("demo")}>
              연습 모드
            </button>
          </div>
        )}

        <article className="market-hero">
          <p className="muted small">Polymarket과 유사한 &quot;풀 기준 내재 확률&quot; (패리뮤추얼 규칙 · CLOB 아님)</p>
          <h2 className="question">{QUESTION}</h2>
          <PoolBar yes={demo.totalYes} no={demo.totalNo} />
          <dl className="odds-grid">
            <div>
              <dt>내재 확률 (YES)</dt>
              <dd>{pYes.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>풀 규모 (YES / NO)</dt>
              <dd>
                {demo.formatUsdc(demo.totalYes)} / {demo.formatUsdc(demo.totalNo)} USDC
              </dd>
            </div>
            <div>
              <dt>YES 승리 시 배수(대략)</dt>
              <dd>
                {demo.yesMultE4 === 0n ? "—" : `${(Number(demo.yesMultE4) / 10000).toFixed(2)}×`}
              </dd>
            </div>
            <div>
              <dt>NO 승리 시 배수(대략)</dt>
              <dd>
                {demo.noMultE4 === 0n ? "—" : `${(Number(demo.noMultE4) / 10000).toFixed(2)}×`}
              </dd>
            </div>
          </dl>
          <p className="muted small">
            배수 = 전체 Pot ÷ 해당 승리 풀 (해당 편 승리 시 비례 분배에 대응).
          </p>
        </article>

        <section className="connect-card">
          <div className="role-row" style={{ border: "none", paddingTop: 0 }}>
            <span className="muted">활동 유저</span>
            <select
              className="select-user"
              value={demo.activeIdx}
              onChange={(e) => demo.setActiveIdx(Number(e.target.value))}
              disabled={demo.busy || demo.resolved}
            >
              {Array.from({ length: demo.MAX_USERS }, (_, i) => (
                <option key={i} value={i}>
                  유저 {i + 1}
                </option>
              ))}
            </select>
            <span className="muted small">참여 {demo.participantCount}명</span>
            <button type="button" className="btn-ghost tiny" onClick={() => demo.reset()}>
              전체 초기화
            </button>
          </div>
          <div className="role-row">
            <span className="muted">역할</span>
            <button type="button" className={demo.role === "user" ? "chip on" : "chip"} onClick={() => demo.setRole("user")}>
              참가자
            </button>
            <button type="button" className={demo.role === "owner" ? "chip on" : "chip"} onClick={() => demo.setRole("owner")}>
              관리자
            </button>
          </div>
          <p className="wallet-line">
            가상 지갑 · YES {demo.formatUsdc(demo.active.yes)} · NO{" "}
            {demo.formatUsdc(demo.active.no)}
            {" · "}잔여 {demo.formatUsdc(demo.active.virtualUsdc)} USDC
          </p>
          {demo.error && <p className="err">{demo.error}</p>}
        </section>

        {!demo.resolved ? (
          <section className="panel">
            <h3 className="panel-title">배팅</h3>
            <label className="field-label">금액 (USDC)</label>
            <input
              className="input-block"
              value={betAmt}
              onChange={(e) => setBetAmt(e.target.value)}
              inputMode="decimal"
            />
            <div className="resolve-btns" style={{ marginTop: "0.65rem" }}>
              <button type="button" className="btn-yes" disabled={demo.busy} onClick={() => void demo.placeBet(true, betAmt)}>
                YES에 걸기
              </button>
              <button type="button" className="btn-no" disabled={demo.busy} onClick={() => void demo.placeBet(false, betAmt)}>
                NO에 걸기
              </button>
            </div>
            {demo.role === "owner" && (
              <>
                <h3 className="panel-title" style={{ marginTop: "1.25rem" }}>
                  관리자
                </h3>
                <div className="resolve-btns">
                  <button type="button" className="btn-yes" disabled={demo.busy} onClick={() => void demo.resolveDemo(true)}>
                    결과 YES 확정
                  </button>
                  <button type="button" className="btn-no" disabled={demo.busy} onClick={() => void demo.resolveDemo(false)}>
                    결과 NO 확정
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="panel panel-claim">
            <h3 className="panel-title">
              정산됨 · 승자: {demo.outcome === 1 ? "YES" : "NO"}
            </h3>
            <p className="panel-lead">유저 1~10 순서 바꿔 가며 각자 「당첨금 받기」를 누르세요.</p>
            <button type="button" className="btn-primary wide" disabled={demo.busy} onClick={() => void demo.claimForActive()}>
              활동 유저 당첨금 정산 (클레임)
            </button>
          </section>
        )}

        <details className="details-block">
          <summary>규칙 (Solidity 동일)</summary>
          <ul className="explain-list">
            <li>별도 주소 최대 10명까지 참여 (연습은 유저 슬롯 10).</li>
            <li>한 슬롯(주소)당 YES+NO 합산 최대 1,000 USDC.</li>
            <li>정산 후 승리 편 참가자가 전체 Pot을 해당 편 예치금 비율로 나눔.</li>
            <li>
              컨트랙트는 <code>PoolBinaryMarket.sol</code> · 실제 거래는 <code>/pool</code>에서 환경
              변수로 연결.
            </li>
          </ul>
        </details>
      </div>
    );
  }

  /* ─── 온체인 모드 ─── */
  const bpsNum = Number(chain.impliedYesBps);
  const pYes = bpsNum / 100;

  return (
    <div className="app pool-page">
      <nav className="subnav">
        <Link href="/">← LP 예측 시장</Link>
      </nav>

      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>풀 배팅 마켓</h1>
            <p className="brand-tag">온체인 PoolBinaryMarket + MetaMask</p>
          </div>
        </div>
      </header>

      {!demoOnly && (
        <div className="segment" style={{ marginBottom: "1rem" }}>
          <button type="button" className={mode === "chain" ? "seg on" : "seg"} disabled={!chain.configured} onClick={() => setMode("chain")}>
            지갑 연결
          </button>
          <button type="button" className={mode === "demo" ? "seg on" : "seg"} onClick={() => setMode("demo")}>
            연습 모드
          </button>
        </div>
      )}

      {!chain.configured && (
        <p className="hint-inline">NEXT_PUBLIC_POOL_MARKET_ADDRESS 필요. 배포 스크립트가 .env.local에 추가합니다.</p>
      )}

      <section className="connect-card">
        <div className="connect-row">
          <button type="button" className="btn-primary" disabled={chain.busy || !chain.configured} onClick={() => void chain.connect()}>
            {chain.address ? "지갑 다시 연결" : "지갑 연결"}
          </button>
        </div>
        {chain.address && (
          <p className="wallet-line">
            <span className="dot-live" />
            {chain.address}
          </p>
        )}
        {wrongChain && (
          <div className="net-alert">
            <button type="button" className="btn-secondary" disabled={chain.busy} onClick={() => void chain.switchToExpectedNetwork()}>
              네트워크 맞추기
            </button>
          </div>
        )}
        {chain.error && <p className="err">{chain.error}</p>}
      </section>

      <article className="market-hero">
        <h2 className="question">{QUESTION}</h2>
        <PoolBar yes={chain.totalYes} no={chain.totalNo} />
        <dl className="odds-grid">
          <div>
            <dt>내재 확률 (YES)</dt>
            <dd>{pYes.toFixed(1)}%</dd>
          </div>
          <div>
            <dt>참여자 수</dt>
            <dd>{chain.participants.toString()} / 10</dd>
          </div>
          <div>
            <dt>YES / NO 배수(대략)</dt>
            <dd>
              {chain.yesMultE4 === 0n ? "—" : `${(Number(chain.yesMultE4) / 10000).toFixed(2)}×`}
              {" / "}
              {chain.noMultE4 === 0n ? "—" : `${(Number(chain.noMultE4) / 10000).toFixed(2)}×`}
            </dd>
          </div>
        </dl>
        {chain.address && (
          <p className="muted small">
            내 예치 YES {chain.formatUsdc(chain.myYes)} · NO {chain.formatUsdc(chain.myNo)} · 지갑
            USDC {chain.formatUsdc(chain.usdcBal)}
          </p>
        )}
      </article>

      {chain.address && !chain.resolved && (
        <section className="panel">
          <label className="field-label">USDC 사용 허용</label>
          <div className="field-row">
            <input type="text" inputMode="decimal" value={approveAmt} onChange={(e) => setApproveAmt(e.target.value)} />
            <button type="button" className="btn-secondary" disabled={chain.busy || wrongChain} onClick={() => void chain.approve(approveAmt)}>
              허용
            </button>
          </div>
          <label className="field-label" style={{ marginTop: "0.85rem" }}>
            배팅 금액
          </label>
          <input className="input-block" value={betAmt} onChange={(e) => setBetAmt(e.target.value)} />
          <div className="resolve-btns" style={{ marginTop: "0.65rem" }}>
            <button type="button" className="btn-yes" disabled={chain.busy || wrongChain} onClick={() => void chain.placeBet(true, betAmt)}>
              YES
            </button>
            <button type="button" className="btn-no" disabled={chain.busy || wrongChain} onClick={() => void chain.placeBet(false, betAmt)}>
              NO
            </button>
          </div>
          {chain.isOwner && (
            <>
              <h3 className="panel-title" style={{ marginTop: "1rem" }}>
                관리자
              </h3>
              <div className="resolve-btns">
                <button type="button" className="btn-yes" disabled={chain.busy} onClick={() => void chain.resolve(true)}>
                  YES 확정
                </button>
                <button type="button" className="btn-no" disabled={chain.busy} onClick={() => void chain.resolve(false)}>
                  NO 확정
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {chain.resolved && chain.address && (
        <section className="panel panel-claim">
          <h3 className="panel-title">
            정산됨 ({chain.outcome === 1 ? "YES" : "NO"})
          </h3>
          <button type="button" className="btn-primary wide" disabled={chain.busy} onClick={() => void chain.claim()}>
            당첨금 클레임
          </button>
        </section>
      )}

      <footer className="app-footer">
        <code>{chain.poolAddress}</code>
      </footer>
    </div>
  );
}
