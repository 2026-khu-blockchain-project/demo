"use client";

import { useState } from "react";
import { usePolyPredict } from "@/hooks/usePolyPredict";
import { usePolyPredictDemo } from "@/hooks/usePolyPredictDemo";

const stateLabel = (s: number) => {
  if (s === 0) return "진행 중";
  if (s === 2) return "정산 완료";
  return String(s);
};

const outcomeLabel = (o: number) => {
  if (o === 0) return "미정";
  if (o === 1) return "YES";
  if (o === 2) return "NO";
  return String(o);
};

function formatDeadline(ts: bigint) {
  const ms = Number(ts) * 1000;
  if (!Number.isFinite(ms)) return String(ts);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

const demoOnly =
  process.env.NEXT_PUBLIC_DEMO_ONLY === "1" ||
  process.env.NEXT_PUBLIC_DEMO_ONLY === "true";

export default function Home() {
  const chain = usePolyPredict();
  const demo = usePolyPredictDemo();
  const [mode, setMode] = useState<"chain" | "demo">(
    demoOnly ? "demo" : chain.configured ? "chain" : "demo"
  );

  const activeMode = demoOnly ? "demo" : mode;
  const p = activeMode === "demo" ? demo : chain;
  const deadlinePassed =
    demo.market != null &&
    Number(demo.market.deadline) <= Math.floor(Date.now() / 1000);

  const [approveAmt, setApproveAmt] = useState("100");
  const [mintAmt, setMintAmt] = useState("10");

  const wrongChain = Boolean(
    !demoOnly && activeMode === "chain" && chain.address && chain.isWrongNetwork
  );

  const connected = Boolean(p.address);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>PolyPredict</h1>
            <p className="brand-tag">USDC로 참여하는 이진 예측 시장</p>
          </div>
        </div>
        {demoOnly && <span className="pill-env">연습 전용</span>}
      </header>

      {!demoOnly && (
        <div className="mode-bar">
          <div className="segment" role="tablist" aria-label="연결 방식">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "chain"}
              className={mode === "chain" ? "seg on" : "seg"}
              disabled={!chain.configured}
              onClick={() => setMode("chain")}
            >
              지갑 연결 (Amoy · 로컬)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "demo"}
              className={mode === "demo" ? "seg on" : "seg"}
              onClick={() => setMode("demo")}
            >
              연습 모드
            </button>
          </div>
          {!chain.configured && (
            <p className="hint-inline">
              컨트랙트 주소가 없으면 「연습 모드」만 사용할 수 있어요. 배포 후 `.env.local`을
              채워 주세요.
            </p>
          )}
        </div>
      )}

      <section className="connect-card">
        <div className="connect-row">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void p.connect()}
            disabled={
              p.busy || (!demoOnly && activeMode === "chain" && !chain.configured)
            }
          >
            {demoOnly
              ? connected
                ? "다시 시작"
                : "연습 시작"
              : connected
                ? "지갑 다시 연결"
                : "지갑 연결"}
          </button>
          {activeMode === "demo" && connected && (
            <button type="button" className="btn-ghost" onClick={() => demo.disconnect()}>
              나가기
            </button>
          )}
        </div>
        {connected && (
          <p className="wallet-line">
            <span className="dot-live" />
            {p.address}
            {p.chainId != null && <span className="chain-pill">chain {p.chainId}</span>}
          </p>
        )}
        {wrongChain && (
          <div className="net-alert">
            <p>
              MetaMask 네트워크가 이 사이트 설정(chain {chain.expectedChainId})과 달라요.
            </p>
            <button
              type="button"
              className="btn-secondary"
              disabled={chain.busy}
              onClick={() => void chain.switchToExpectedNetwork()}
            >
              맞는 네트워크로 바꾸기
            </button>
          </div>
        )}
        {activeMode === "demo" && connected && (
          <div className="role-row">
            <span className="muted">역할</span>
            <button
              type="button"
              className={demo.role === "user" ? "chip on" : "chip"}
              onClick={() => demo.setRole("user")}
            >
              참가자
            </button>
            <button
              type="button"
              className={demo.role === "owner" ? "chip on" : "chip"}
              onClick={() => demo.setRole("owner")}
            >
              관리자
            </button>
            <button type="button" className="btn-ghost tiny" onClick={() => demo.resetDemo()}>
              초기화
            </button>
          </div>
        )}
        {p.error && <p className="err">{p.error}</p>}
      </section>

      {p.market && (
        <main className="main-flow">
          <article className="market-hero">
            <div className="market-meta">
              <span className={`status-dot s${p.market.state}`} />
              <span>{stateLabel(p.market.state)}</span>
              {p.market.state === 2 && (
                <span className="outcome-pill">결과 {outcomeLabel(p.market.outcome)}</span>
              )}
            </div>
            <h2 className="question">{p.market.question}</h2>
            <dl className="market-stats">
              <div>
                <dt>마감</dt>
                <dd>{formatDeadline(p.market.deadline)}</dd>
              </div>
              <div>
                <dt>시장 유동성</dt>
                <dd>{p.formatUsdc(p.market.totalCollateral)} USDC</dd>
              </div>
            </dl>
          </article>

          {connected ? (
            <>
              <section className="balances-strip">
                <div className="bal-cell">
                  <span className="bal-label">지갑 USDC</span>
                  <strong>{p.formatUsdc(p.usdcBal)}</strong>
                </div>
                <div className="bal-cell yes">
                  <span className="bal-label">YES 지분</span>
                  <strong>{p.formatUsdc(p.yesBal)}</strong>
                </div>
                <div className="bal-cell no">
                  <span className="bal-label">NO 지분</span>
                  <strong>{p.formatUsdc(p.noBal)}</strong>
                </div>
              </section>

              <section className="panel">
                <h3 className="panel-title">시장 참여</h3>
                <p className="panel-lead">
                  USDC를 맡기면 같은 수만큼 YES·NO가 함께 생겨요. 먼저 앱이 USDC를 쓸 수 있게
                  허용한 뒤, 예치할 금액을 정해 주세요.
                </p>
                <div className="step-block">
                  <span className="step-num">1</span>
                  <div className="step-body">
                    <label className="field-label">허용할 USDC</label>
                    <div className="field-row">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={approveAmt}
                        onChange={(e) => setApproveAmt(e.target.value)}
                        placeholder="예: 100"
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={p.busy || wrongChain}
                        onClick={() => void p.approve(approveAmt)}
                      >
                        사용 허용
                      </button>
                    </div>
                  </div>
                </div>
                <div className="step-block">
                  <span className="step-num">2</span>
                  <div className="step-body">
                    <label className="field-label">예치할 USDC (YES+NO 동시 발행)</label>
                    <div className="field-row">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={mintAmt}
                        onChange={(e) => setMintAmt(e.target.value)}
                        placeholder="예: 10"
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={p.busy || wrongChain || p.market.state !== 0}
                        onClick={() => void p.mint(mintAmt)}
                      >
                        지분 받기
                      </button>
                    </div>
                    {p.market.state !== 0 && (
                      <p className="field-hint">이 시장은 참여 마감됐어요.</p>
                    )}
                  </div>
                </div>
              </section>

              {activeMode === "demo" &&
                demo.address &&
                demo.role === "owner" &&
                demo.market.state === 0 && (
                  <section className="panel panel-admin">
                    <h3 className="panel-title">관리자 · 결과 확정</h3>
                    <p className="panel-lead muted">
                      실제 온체인은 마감 후에만 확정할 수 있어요. 연습에서는 마감을 맞춘 뒤
                      결과를 고르세요.
                    </p>
                    <div className="admin-row">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => demo.demoSkipDeadline()}
                      >
                        연습: 마감 지나간 걸로 맞추기
                      </button>
                      {!deadlinePassed && (
                        <span className="muted small">마감 전이면 확정이 막혀요.</span>
                      )}
                    </div>
                    <div className="resolve-btns">
                      <button
                        type="button"
                        className="btn-yes"
                        disabled={demo.busy}
                        onClick={() => void demo.resolve("YES")}
                      >
                        YES로 확정
                      </button>
                      <button
                        type="button"
                        className="btn-no"
                        disabled={demo.busy}
                        onClick={() => void demo.resolve("NO")}
                      >
                        NO로 확정
                      </button>
                    </div>
                  </section>
                )}

              {!demoOnly &&
                activeMode === "chain" &&
                chain.address &&
                chain.isOwner &&
                chain.market?.state === 0 && (
                  <section className="panel panel-admin">
                    <h3 className="panel-title">관리자 · 결과 확정</h3>
                    <p className="panel-lead muted">마감 시각 이후에만 블록체인에서 처리돼요.</p>
                    <div className="resolve-btns">
                      <button
                        type="button"
                        className="btn-yes"
                        disabled={chain.busy}
                        onClick={() => void chain.resolve("YES")}
                      >
                        YES로 확정
                      </button>
                      <button
                        type="button"
                        className="btn-no"
                        disabled={chain.busy}
                        onClick={() => void chain.resolve("NO")}
                      >
                        NO로 확정
                      </button>
                    </div>
                  </section>
                )}

              {p.market.state === 2 && (
                <section className="panel panel-claim">
                  <h3 className="panel-title">당첨 정산</h3>
                  <p className="panel-lead">
                    맞은 쪽 지분만큼 USDC로 돌려받아요. (연습 모드는 역할을 참가자로 두세요.)
                  </p>
                  <button
                    type="button"
                    className="btn-primary wide"
                    disabled={p.busy}
                    onClick={() => void p.claim()}
                  >
                    당첨금 받기
                  </button>
                </section>
              )}
            </>
          ) : (
            <p className="empty-hint">
              {demoOnly
                ? "「연습 시작」을 누르면 잔고와 참여 버튼이 나와요."
                : "먼저 지갑을 연결해 주세요."}
            </p>
          )}

          {!demoOnly && activeMode === "chain" && chain.contractOwner && (
            <p className="owner-ref muted small">
              시장 관리 주소: <span className="mono">{chain.contractOwner}</span>
            </p>
          )}
        </main>
      )}

      <details className="details-block">
        <summary>이 서비스는 어떻게 동작하나요?</summary>
        <ol className="explain-list">
          <li>USDC를 예치하면 같은 수량의 YES·NO 지분이 동시에 생깁니다.</li>
          <li>마감 뒤 결과가 정해지면, 맞춘 쪽 지분만큼 USDC를 돌려받습니다.</li>
          <li>온체인이라 누구나 규칙과 잔액을 투명하게 확인할 수 있습니다.</li>
        </ol>
      </details>

      <details className="details-block">
        <summary>발표·개발 (Solidity 요약)</summary>
        <ul className="explain-list">
          <li>
            <code>PolyPredict.sol</code> — ERC-1155, Ownable, ReentrancyGuard
          </li>
          <li>토큰 ID: 시장 m → YES <code>2m</code>, NO <code>2m+1</code></li>
          <li>예치 <code>mintShares</code> · 확정 <code>resolveMarket</code> · 수령{" "}
            <code>claimWinnings</code>
          </li>
        </ul>
      </details>

      <footer className="app-footer">
        {demoOnly ? (
          <span>연습용 시뮬레이션 · 주소는 표시용입니다.</span>
        ) : (
          <span className="footer-addr">
            <code>{p.polyAddress}</code>
            <code>{p.usdcAddress}</code>
            {chain.expectedChainId != null && (
              <span> · chain {chain.expectedChainId}</span>
            )}
          </span>
        )}
      </footer>
    </div>
  );
}
