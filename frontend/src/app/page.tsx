"use client";

import { useState } from "react";
import { usePolyPredict } from "@/hooks/usePolyPredict";
import { usePolyPredictDemo } from "@/hooks/usePolyPredictDemo";

const stateLabel = (s: number) => {
  if (s === 0) return "OPEN";
  if (s === 2) return "RESOLVED";
  return String(s);
};

const outcomeLabel = (o: number) => {
  if (o === 0) return "—";
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

/** Vercel 등 배포 시 `NEXT_PUBLIC_DEMO_ONLY=1` → MetaMask 없이 오프체인 데모만 표시 */
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

  return (
    <div className="page">
      <header className="header">
        <h1>PolyPredict</h1>
        <p className="sub">
          USDC 담보 이진 예측 시장 — ERC-1155 + Solidity 발표 데모
          {demoOnly && (
            <>
              {" "}
              <span className="badge">오프체인 전용 URL</span>
            </>
          )}
        </p>
      </header>

      <section className="block">
        <h2>동작 원리</h2>
        <ol className="numbered">
          <li>
            <strong>유동성 공급</strong> — 사용자가 USDC를 컨트랙트에 예치하면, 같은 수량만큼 YES·NO
            지분(토큰)이 동시에 발행됩니다. 항상 1:1 쌍이라 초기에는 중립 포지션입니다.
          </li>
          <li>
            <strong>거래(본 프로젝트 범위 밖)</strong> — 실제 서비스에서는 YES/NO를 서로 맞바꾸며
            가격이 형성됩니다. 여기서는 컨트랙트의 <em>발행·정산·클레임</em>만 다룹니다.
          </li>
          <li>
            <strong>정산</strong> — 마감 후 Owner가 결과(YES/NO)를 확정하면, 승리 쪽 지분 1단위당 1
            USDC를 돌려주고 패배 쪽 지분은 소각됩니다.
          </li>
        </ol>
      </section>

      <section className="block">
        <h2>Solidity 구현 요약</h2>
        <ul className="bullets">
          <li>
            <code>contracts/PolyPredict.sol</code> — OpenZeppelin{" "}
            <code>ERC1155</code>, <code>Ownable</code>, <code>ReentrancyGuard</code>
          </li>
          <li>
            시장 <code>marketId = m</code>일 때 YES 토큰 ID = <code>2m</code>, NO ={" "}
            <code>2m + 1</code> (<code>getTokenIds</code>)
          </li>
          <li>
            <code>mintShares</code> — <code>USDC.transferFrom</code> 후{" "}
            <code>_mint</code>로 YES·NO 동일 수량 발행
          </li>
          <li>
            <code>resolveMarket</code> — Owner만, 마감 시각 이후 · 결과 enum(YES/NO)
          </li>
          <li>
            <code>claimWinnings</code> — 승리 토큰만큼 USDC 출금, 관련 토큰 burn
          </li>
        </ul>
      </section>

      <section className="block">
        <h2>{demoOnly ? "오프체인 데모" : "지갑 연결"}</h2>
        {demoOnly ? (
          <p className="muted">
            브라우저 안에서만 동작하는 시뮬레이션입니다. MetaMask·블록체인 RPC 없이 승인 → 민트 →
            정산 → 클레임 흐름을 익힐 수 있습니다.
          </p>
        ) : (
          <>
            <p className="muted">
              로컬 체인은 MetaMask를 같은 RPC·Chain ID로 맞춘 뒤 연결합니다. 배포 주소는{" "}
              <code>npm run deploy:local</code> 후 자동으로 <code>frontend/.env.local</code>에
              기록됩니다.
            </p>
            <div className="mode">
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "chain"}
                  onChange={() => setMode("chain")}
                  disabled={!chain.configured}
                />{" "}
                로컬 체인 (MetaMask · 실제 트랜잭션)
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "demo"}
                  onChange={() => setMode("demo")}
                />{" "}
                오프체인 연습 (지갑 없이 흐름만)
              </label>
            </div>
            {!chain.configured && (
              <p className="warn compact">
                <code>.env.local</code> 미설정 → 위에서 「오프체인 연습」을 선택하거나, 루트에서
                배포 후 새로고침하세요.
              </p>
            )}
          </>
        )}
        <div className="actions">
          <button
            type="button"
            onClick={() => void p.connect()}
            disabled={p.busy || (!demoOnly && activeMode === "chain" && !chain.configured)}
          >
            {demoOnly
              ? p.address
                ? "데모 다시 시작"
                : "데모 시작"
              : p.address
                ? "지갑 다시 연결"
                : "MetaMask 연결"}
          </button>
          {activeMode === "demo" && p.address && (
            <button type="button" className="ghost" onClick={() => demo.disconnect()}>
              연결 해제
            </button>
          )}
        </div>
        {p.address && (
          <p className="mono ok">
            {p.address}
            {p.chainId != null ? ` · chainId ${p.chainId}` : ""}
          </p>
        )}
        {activeMode === "demo" && p.address && (
          <div className="demo-tools">
            <span className="muted">역할:</span>
            <button
              type="button"
              className={`pill ${demo.role === "user" ? "on" : ""}`}
              onClick={() => demo.setRole("user")}
            >
              참가자
            </button>
            <button
              type="button"
              className={`pill ${demo.role === "owner" ? "on" : ""}`}
              onClick={() => demo.setRole("owner")}
            >
              Owner
            </button>
            <button type="button" className="ghost small" onClick={() => demo.resetDemo()}>
              데모 리셋
            </button>
          </div>
        )}
        {p.error && <p className="err">{p.error}</p>}
      </section>

      {p.market && (
        <>
          <section className="block">
            <h2>시장 · 잔고 · 트랜잭션</h2>
            <dl className="kv">
              <dt>질문</dt>
              <dd>{p.market.question}</dd>
              <dt>상태 / 결과</dt>
              <dd>
                {stateLabel(p.market.state)} · {outcomeLabel(p.market.outcome)}
              </dd>
              <dt>마감</dt>
              <dd>{formatDeadline(p.market.deadline)}</dd>
              <dt>총 담보 (USDC)</dt>
              <dd>{p.formatUsdc(p.market.totalCollateral)}</dd>
              {!demoOnly && activeMode === "chain" && chain.contractOwner && (
                <>
                  <dt>컨트랙트 Owner</dt>
                  <dd className="mono">{chain.contractOwner}</dd>
                </>
              )}
            </dl>

            {p.address ? (
              <>
                <p className="label">내 잔고</p>
                <ul className="inline-bal">
                  <li>
                    USDC <strong>{p.formatUsdc(p.usdcBal)}</strong>
                  </li>
                  <li>
                    YES <strong>{p.formatUsdc(p.yesBal)}</strong>
                  </li>
                  <li>
                    NO <strong>{p.formatUsdc(p.noBal)}</strong>
                  </li>
                </ul>
                <div className="field">
                  <label htmlFor="ap">approve (USDC 수량)</label>
                  <div className="inline">
                    <input
                      id="ap"
                      type="text"
                      inputMode="decimal"
                      value={approveAmt}
                      onChange={(e) => setApproveAmt(e.target.value)}
                    />
                    <button
                      type="button"
                      className="secondary"
                      disabled={p.busy}
                      onClick={() => void p.approve(approveAmt)}
                    >
                      approve
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="mt">mintShares(marketId=0, amount)</label>
                  <div className="inline">
                    <input
                      id="mt"
                      type="text"
                      inputMode="decimal"
                      value={mintAmt}
                      onChange={(e) => setMintAmt(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={p.busy || p.market.state !== 0}
                      onClick={() => void p.mint(mintAmt)}
                    >
                      실행
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="muted compact">
                {demoOnly ? "「데모 시작」을 누르면 잔고와 버튼이 표시됩니다." : "지갑을 연결하면 잔고와 버튼이 표시됩니다."}
              </p>
            )}
          </section>

          {activeMode === "demo" &&
            demo.address &&
            demo.role === "owner" &&
            demo.market.state === 0 && (
              <section className="block admin">
                <h2>Owner · resolveMarket</h2>
                <p className="muted compact">
                  실제 컨트랙트는 마감 이후만 호출 가능합니다. 연습에서는 마감을 맞춘 뒤 YES/NO를
                  누르세요.
                </p>
                <div className="actions">
                  <button type="button" className="secondary" onClick={() => demo.demoSkipDeadline()}>
                    데모: 마감 시각을 과거로
                  </button>
                  {!deadlinePassed && (
                    <span className="muted small">마감 전이면 컨트랙트와 동일하게 실패합니다.</span>
                  )}
                </div>
                <div className="actions">
                  <button type="button" disabled={demo.busy} onClick={() => void demo.resolve("YES")}>
                    resolve → YES
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={demo.busy}
                    onClick={() => void demo.resolve("NO")}
                  >
                    resolve → NO
                  </button>
                </div>
              </section>
            )}

          {!demoOnly &&
            activeMode === "chain" &&
            chain.address &&
            chain.isOwner &&
            chain.market?.state === 0 && (
            <section className="block admin">
              <h2>Owner · resolveMarket</h2>
              <p className="muted compact">마감 시각 이후에만 트랜잭션이 성공합니다.</p>
              <div className="actions">
                <button type="button" disabled={chain.busy} onClick={() => void chain.resolve("YES")}>
                  YES
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={chain.busy}
                  onClick={() => void chain.resolve("NO")}
                >
                  NO
                </button>
              </div>
            </section>
          )}

          {p.address && p.market.state === 2 && (
            <section className="block">
              <h2>claimWinnings</h2>
              <p className="muted compact">
                정산 완료 후 승리 지분만큼 USDC를 받습니다. (연습 모드는 역할을 참가자로 두세요.)
              </p>
              <button type="button" disabled={p.busy} onClick={() => void p.claim()}>
                claimWinnings(0)
              </button>
            </section>
          )}
        </>
      )}

      <footer className="footer muted">
        {demoOnly ? (
          <p>오프체인 시뮬레이션 · 주소는 표시용 더미입니다.</p>
        ) : (
          <>
            <code>{p.polyAddress}</code>
            {" · "}
            <code>{p.usdcAddress}</code>
          </>
        )}
      </footer>
    </div>
  );
}
