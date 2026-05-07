import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolyPredict — 발표 데모",
  description: "Solidity 예측 시장 컨트랙트 · 동작 원리 · 지갑 연결 데모",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
