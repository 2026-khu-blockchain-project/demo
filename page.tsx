"use client";

import { useEffect, useState } from "react";
import {
  useWallet,
  useMarkets,
  useMintShares,
  useClaimWinnings,
  Market,
  STATE_LABEL,
  OUTCOME_LABEL,
  formatUsdc,
  formatDeadline,
} from "../hooks/usePolyPredict";

// ================================================================
// 색상 팔레트 (Poly Blue 테마)
// ================================================================
const C = {
  blue:   "#2E5CFF",
  blueLt: "#EEF2FF",
  green:  "#16a34a",
  red:    "#dc2626",
  gray:   "#64748b",
  border: "#e2e8f0",
};

// ================================================================
// 컴포넌트: 지갑 연결 버튼
// ================================================================
function WalletButton({
  account, connect, disconnect,
}: {
  account: string | null;
  connect: () => void;
  disconnect: () => void;
}) {
  if (!account) {
    return (
      <button
        onClick={connect}
        style={{
          background: C.blue, color: "#fff", border: "none",
          borderRadius: 8, padding: "10px 20px", fontWeight: 700,
          cursor: "pointer", fontSize: 15,
        }}
      >
        🦊 지갑 연결
      </button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{
        background: C.blueLt, color: C.blue, borderRadius: 20,
        padding: "6px 14px", fontWeight: 600, fontSize: 13,
      }}>
        {account.slice(0, 6)}...{account.slice(-4)}
      </span>
      <button
        onClick={disconnect}
        style={{
          background: "none", color: C.gray, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "6px 14px", cursor: "pointer",
        }}
      >
        연결 해제
      </button>
    </div>
  );
}

// ================================================================
// 컴포넌트: 시장 카드
// ================================================================
function MarketCard({
  market, account, provider,
}: {
  market: Market;
  account: string | null;
  provider: any;
}) {
  const [amount, setAmount] = useState("10");
  const { mintShares, loading: mintLoading, txHash: mintTx, error: mintError } = useMintShares(provider);
  const { claimWinnings, loading: claimLoading, txHash: claimTx, error: claimError } = useClaimWinnings(provider);

  const stateColor = market.state === 0 ? C.green : market.state === 1 ? C.gray : C.blue;
  const isOpen = market.state === 0 && Date.now() / 1000 < market.deadline;

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`,
      padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      {/* 상태 배지 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{
          background: stateColor + "22", color: stateColor,
          borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700,
        }}>
          ● {STATE_LABEL[market.state]}
        </span>
        <span style={{ color: C.gray, fontSize: 12 }}>
          Market #{market.id}
        </span>
      </div>

      {/* 질문 */}
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
        {market.question}
      </h3>

      {/* 정보 */}
      <div style={{ color: C.gray, fontSize: 13, marginBottom: 16 }}>
        <div>⏰ 마감: {formatDeadline(market.deadline)}</div>
        <div>💰 총 담보: {formatUsdc(market.totalCollateral)} USDC</div>
        {market.state === 2 && (
          <div style={{ color: C.blue, fontWeight: 700, marginTop: 4 }}>
            🏆 결과: {OUTCOME_LABEL[market.outcome]}
          </div>
        )}
      </div>

      {/* 확률 바 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: C.green, fontWeight: 600 }}>YES 50%</span>
          <span style={{ color: C.red,   fontWeight: 600 }}>NO 50%</span>
        </div>
        <div style={{ background: "#fee2e2", borderRadius: 8, height: 8, overflow: "hidden" }}>
          <div style={{ background: C.green, width: "50%", height: "100%", borderRadius: 8 }} />
        </div>
      </div>

      {/* 액션 버튼 */}
      {account ? (
        <>
          {isOpen && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                style={{
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: "8px 12px", width: 80, fontSize: 14,
                }}
              />
              <span style={{ alignSelf: "center", color: C.gray, fontSize: 13 }}>USDC</span>
              <button
                onClick={() => mintShares(market.id, Number(amount))}
                disabled={mintLoading}
                style={{
                  flex: 1, background: C.blue, color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 0", fontWeight: 700,
                  cursor: mintLoading ? "not-allowed" : "pointer", fontSize: 14,
                  opacity: mintLoading ? 0.6 : 1,
                }}
              >
                {mintLoading ? "처리 중..." : "🪙 주식 구매"}
              </button>
            </div>
          )}

          {market.state === 2 && (
            <button
              onClick={() => claimWinnings(market.id)}
              disabled={claimLoading}
              style={{
                width: "100%", background: C.green, color: "#fff", border: "none",
                borderRadius: 8, padding: "10px 0", fontWeight: 700,
                cursor: claimLoading ? "not-allowed" : "pointer", fontSize: 14,
                opacity: claimLoading ? 0.6 : 1,
              }}
            >
              {claimLoading ? "처리 중..." : "🏆 당첨금 수령"}
            </button>
          )}

          {(mintTx || claimTx) && (
            <p style={{ color: C.green, fontSize: 12, marginTop: 8 }}>
              ✅ 트랜잭션 완료!{" "}
              <a
                href={`https://amoy.polygonscan.com/tx/${mintTx ?? claimTx}`}
                target="_blank" rel="noreferrer"
                style={{ color: C.blue }}
              >
                Polygonscan에서 보기
              </a>
            </p>
          )}
          {(mintError || claimError) && (
            <p style={{ color: C.red, fontSize: 12, marginTop: 8 }}>
              ❌ {mintError ?? claimError}
            </p>
          )}
        </>
      ) : (
        <p style={{ color: C.gray, fontSize: 13, textAlign: "center" }}>
          거래하려면 지갑을 연결하세요
        </p>
      )}
    </div>
  );
}

// ================================================================
// 메인 페이지
// ================================================================
export default function Home() {
  const { account, provider, connect, disconnect, error: walletError } = useWallet();
  const { markets, loading, fetchMarkets } = useMarkets(provider);

  useEffect(() => {
    if (provider) fetchMarkets();
  }, [provider, fetchMarkets]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* 헤더 */}
      <header style={{
        background: "#fff", borderBottom: `1px solid ${C.border}`,
        padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, background: C.blue, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: 16,
          }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#1e293b" }}>PolyPredict</span>
          <span style={{ color: C.gray, fontSize: 13 }}>탈중앙화 예측 시장</span>
        </div>
        <WalletButton account={account} connect={connect} disconnect={disconnect} />
      </header>

      {/* 메인 */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* 히어로 배너 */}
        <div style={{
          background: `linear-gradient(135deg, ${C.blue}, #5b4fff)`,
          borderRadius: 20, padding: "40px 48px", marginBottom: 40, color: "#fff",
        }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 32, fontWeight: 900 }}>
            미래를 예측하고 수익을 얻으세요
          </h1>
          <p style={{ margin: 0, fontSize: 16, opacity: 0.85 }}>
            모든 예치금과 정산은 스마트 컨트랙트가 자동으로 처리합니다. 중앙 관리자가 없습니다.
          </p>
          <div style={{ display: "flex", gap: 24, marginTop: 28 }}>
            {[
              { label: "총 시장 수", value: markets.length },
              { label: "오픈 시장", value: markets.filter(m => m.state === 0).length },
              { label: "정산 완료", value: markets.filter(m => m.state === 2).length },
            ].map(stat => (
              <div key={stat.label} style={{
                background: "rgba(255,255,255,0.15)", borderRadius: 12,
                padding: "16px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{stat.value}</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 시장 목록 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b" }}>
            예측 시장
          </h2>
          <button
            onClick={fetchMarkets}
            disabled={loading}
            style={{
              background: C.blueLt, color: C.blue, border: "none",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontWeight: 600, fontSize: 13,
            }}
          >
            {loading ? "로딩 중..." : "🔄 새로고침"}
          </button>
        </div>

        {walletError && (
          <div style={{
            background: "#fee2e2", color: C.red, borderRadius: 12,
            padding: "12px 16px", marginBottom: 20, fontSize: 14,
          }}>
            ⚠️ {walletError}
          </div>
        )}

        {!account ? (
          <div style={{
            background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`,
            padding: "60px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🦊</div>
            <h3 style={{ margin: "0 0 8px", color: "#1e293b" }}>지갑을 연결하세요</h3>
            <p style={{ color: C.gray, margin: "0 0 24px" }}>
              MetaMask를 연결하면 예측 시장에 참여할 수 있습니다.
            </p>
            <button
              onClick={connect}
              style={{
                background: C.blue, color: "#fff", border: "none",
                borderRadius: 10, padding: "12px 32px", fontWeight: 700,
                cursor: "pointer", fontSize: 16,
              }}
            >
              MetaMask 연결
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.gray }}>
            시장 데이터를 불러오는 중...
          </div>
        ) : markets.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`,
            padding: "60px 32px", textAlign: "center", color: C.gray,
          }}>
            생성된 시장이 없습니다. 컨트랙트에서 시장을 생성해주세요.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
          }}>
            {markets.map(market => (
              <MarketCard
                key={market.id}
                market={market}
                account={account}
                provider={provider}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
