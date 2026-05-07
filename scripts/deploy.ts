import fs from "node:fs";
import path from "node:path";
import { parseUnits } from "ethers";
import { network } from "hardhat";

async function main() {
  const conn = await network.getOrCreate();
  const { ethers } = conn;
  const networkName = conn.networkName;

  const [deployer] = await ethers.getSigners();
  console.log("배포 계정:", deployer.address);
  console.log("네트워크:", networkName);

  let usdcAddress: string;

  if (networkName === "localhost" || networkName === "amoy") {
    console.log("\n[1/2] MockUSDC 배포 중...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("MockUSDC 배포 완료:", usdcAddress);

    const mintTx = await mockUsdc.mint(deployer.address, parseUnits("10000", 6));
    await mintTx.wait();
    console.log("테스트 USDC 10,000개 발행 완료");
  } else {
    usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    console.log("실제 USDC 주소 사용:", usdcAddress);
  }

  console.log("\n[2/2] PolyPredict 배포 중...");
  const PolyPredict = await ethers.getContractFactory("PolyPredict");
  const polyPredict = await PolyPredict.deploy(usdcAddress);
  await polyPredict.waitForDeployment();
  const polyPredictAddress = await polyPredict.getAddress();
  console.log("PolyPredict 배포 완료:", polyPredictAddress);

  if (networkName !== "polygon") {
    console.log("\n[보너스] 샘플 시장 생성 중...");
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const tx = await polyPredict.createMarket(
      "바이에른 뮌헨이 2026 UEFA 챔피언스리그에서 우승할까?",
      deadline
    );
    await tx.wait();
    console.log("샘플 시장 생성 완료! (Market ID: 0)");
  }

  console.log("\n==============================");
  console.log("배포 요약");
  console.log("==============================");
  console.log("USDC 주소      :", usdcAddress);
  console.log("PolyPredict 주소:", polyPredictAddress);
  console.log("\nNext.js용 환경 변수:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${polyPredictAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);

  const autoWrite =
    networkName === "localhost" ||
    networkName === "amoy" ||
    process.env.WRITE_FRONTEND_ENV === "1";
  const skipWrite = process.env.SKIP_FRONTEND_ENV === "1";

  if (autoWrite && !skipWrite) {
    const envPath = path.join(process.cwd(), "frontend", ".env.local");
    const chainIdLine =
      networkName === "amoy"
        ? "NEXT_PUBLIC_CHAIN_ID=80002\n"
        : networkName === "localhost"
          ? "NEXT_PUBLIC_CHAIN_ID=31337\n"
          : "";
    const body =
      `NEXT_PUBLIC_CONTRACT_ADDRESS=${polyPredictAddress}\n` +
      `NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}\n` +
      chainIdLine;
    fs.writeFileSync(envPath, body, "utf8");
    console.log("\n[frontend] 자동 저장:", envPath);
  } else if (!autoWrite) {
    console.log(
      "\n[frontend] 자동 저장 안 함 (localhost/amoy가 아님). 필요하면 WRITE_FRONTEND_ENV=1 로 다시 배포하세요."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
