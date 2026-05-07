# PolyPredict 🔮

**탈중앙화 예측 시장** — Solidity 스마트 컨트랙트를 이용한 Binary Option 정산 시스템

> "가격은 곧 시장이 판단하는 확률이다."

---

## 📁 프로젝트 구조

```
polypredict/
├── contracts/
│   ├── PolyPredict.sol      ← 핵심 스마트 컨트랙트 (ERC-1155 기반)
│   └── MockUSDC.sol         ← 테스트용 USDC 토큰
│
├── scripts/
│   └── deploy.ts            ← 배포 스크립트
│
├── test/
│   └── PolyPredict.test.ts  ← 단위 테스트 (Chai)
│
├── frontend/
│   └── src/
│       ├── abis/
│       │   └── PolyPredict.ts   ← 컨트랙트 ABI
│       ├── hooks/
│       │   └── usePolyPredict.ts ← Web3 훅 (지갑/민팅/정산)
│       └── app/
│           └── page.tsx         ← 메인 대시보드
│
├── hardhat.config.ts
├── package.json
└── .env.example
```

---

## ⚙️ 핵심 설계 원칙

### 1. ERC-1155 멀티토큰
- YES 토큰 ID = `marketId * 2`
- NO  토큰 ID = `marketId * 2 + 1`
- 하나의 컨트랙트에서 모든 시장의 YES/NO 토큰 관리

### 2. 담보화 (Collateralization)
```
1 USDC 예치 → 1 YES + 1 NO 발행
∴ 총 주식 가치 = 총 예치 USDC (항상 동일)
```

### 3. 정산 흐름
```
createMarket() → mintShares() → resolveMarket() → claimWinnings()
    [관리자]         [사용자]         [관리자]          [사용자]
```

---

## 🚀 빠른 시작

### 환경 설치
```bash
# 루트 (컨트랙트)
npm install

# 프론트엔드
cd frontend && npm install
```

### 컨트랙트 컴파일 & 테스트
```bash
npx hardhat compile
npx hardhat test
```
> 테스트 결과: createMarket, mintShares, resolveMarket, claimWinnings 전체 엣지 케이스 검증

### 로컬 배포 (개발용)
```bash
# 터미널 1: 로컬 블록체인 실행
npx hardhat node

# 터미널 2: 배포
npm run deploy:local
```

### Polygon Amoy 테스트넷 배포
```bash
# 1. .env 파일 설정
cp .env.example .env
# PRIVATE_KEY, AMOY_RPC_URL 입력

# 2. Amoy 테스트 MATIC 받기 (https://faucet.polygon.technology)

# 3. 배포
npm run deploy:amoy
```

### 프론트엔드 실행
```bash
# 로컬·Amoy 배포 시 scripts/deploy.ts 가 frontend/.env.local 을 자동 갱신합니다.
cd frontend
npm run dev
```

### 과제·발표용: MetaMask + Polygon Amoy

수업 요건(솔리디티 + 상호작용 프론트 + MetaMask 연결)을 맞추려면 **테스트넷에 배포한 컨트랙트 주소**로 프론트를 열고, 지갑은 **같은 Chain ID**로 맞추면 됩니다.

1. **Amoy MATIC** — [Polygon Faucet](https://faucet.polygon.technology) 등에서 테스트용 MATIC 수령.
2. **루트에서 배포** — `.env`에 `PRIVATE_KEY` 등 입력 후:
   ```bash
   npm run deploy:amoy
   ```
   터미널에 나온 PolyPredict / MockUSDC 주소를 확인하고, `frontend/.env.local`이 갱신되었는지 확인합니다.
3. **`NEXT_PUBLIC_CHAIN_ID`** — `npm run deploy:amoy`(또는 `deploy:local`) 실행 시 `scripts/deploy.ts`가 **Amoy는 80002, 로컬은 31337**로 `frontend/.env.local`에 자동 기록합니다. 수동으로 넣을 필요는 없습니다.
4. **로컬에서 연결 테스트** — `cd frontend && npm run dev` 후 MetaMask 연결 → 네트워크가 다르면 화면의 **「Amoy / 로컬 네트워크로 전환」** 버튼 사용 가능.
5. **Vercel** — Root Directory `frontend`, **환경 변수**에 `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID=80002` 설정. 과제 제출용 공개 URL에서는 **`NEXT_PUBLIC_DEMO_ONLY`는 넣지 않거나 삭제** (오프체인 전용으로 숨기면 MetaMask 탭이 안 나옵니다).

발표 순서 예시: (1) 사이트 접속 → (2) **EVM 체인** 선택 → (3) **MetaMask 연결** → (4) 필요 시 네트워크 전환 → (5) **approve → mintShares** 한 번 호출해 트랜잭션 확인.

---

## 🔑 핵심 함수 요약

| 함수 | 호출자 | 설명 |
|------|--------|------|
| `createMarket(question, deadline)` | Owner | 시장 생성 |
| `mintShares(marketId, amount)` | 누구나 | USDC 예치 후 YES+NO 토큰 발행 |
| `resolveMarket(marketId, outcome)` | Owner | 결과 확정 (관리자) |
| `claimWinnings(marketId)` | 누구나 | 당첨금 수령 |

---

## 🛡️ 보안 설계

- **ReentrancyGuard**: claimWinnings, mintShares에 적용 → 재진입 공격 방지
- **Ownable**: createMarket은 배포자만 호출 가능
- **관리자 정산**: resolveMarket은 컨트랙트 Owner만 호출 가능 (Polymarket 단순 클론 모델)
- **담보 무결성**: mintShares에서 USDC 입금 확인 후 토큰 발행

---

## 📅 개발 로드맵

| 단계 | 기간 | 내용 |
|------|------|------|
| 1단계 | 4월 | 솔리디티 컨트랙트 개발 + Amoy 테스트넷 배포 ✅ |
| 2단계 | 5월 | MetaMask 연동 + 민팅/정산 프론트엔드 구축 |
| 3단계 | 6월 | 간이 AMM 거래 기능 + 전체 시나리오 테스트 |

---

## 💡 개발 팁

- Polymarket 등 공개 코드를 그대로 가져올 때는 **저장소별 라이선스**(예: AGPL)를 확인한 뒤 사용 범위를 맞추세요.
- 테스트 실패 시 `npx hardhat test --verbose`로 상세 로그 확인
- 가스비 최적화 확인: `npm run test:gas` (내부적으로 `hardhat test --gas-stats`)
- Polygonscan에서 컨트랙트 검증: `npx hardhat verify --network amoy <주소> <USDC주소>`
