import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolyPredict",
  description: "USDC 담보 이진 예측 시장 — 지갑 연결 및 시장 참여",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
