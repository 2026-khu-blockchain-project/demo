import { expect } from "chai";
import { parseUnits } from "ethers";
import { network } from "hardhat";
import type { HardhatEthers, HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import type { NetworkHelpers } from "@nomicfoundation/hardhat-network-helpers/types";
import type { PolyPredict, MockUSDC } from "../types/ethers-contracts/index.js";

const USDC = (amount: number) => parseUnits(amount.toString(), 6);

describe("PolyPredict", () => {
  let ethers: HardhatEthers;
  let networkHelpers: NetworkHelpers;

  let polyPredict: PolyPredict;
  let usdc: MockUSDC;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  let marketId: bigint;
  let deadline: number;

  beforeEach(async () => {
    const conn = await network.getOrCreate();
    ethers = conn.ethers;
    networkHelpers = conn.networkHelpers;

    [owner, alice, bob] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDCFactory.deploy();

    const PolyPredictFactory = await ethers.getContractFactory("PolyPredict");
    polyPredict = await PolyPredictFactory.deploy(await usdc.getAddress());

    await usdc.mint(alice.address, USDC(1000));
    await usdc.mint(bob.address, USDC(1000));

    deadline = (await networkHelpers.time.latest()) + 60 * 60 * 24;
    const tx = await polyPredict.createMarket("바이에른 뮌헨이 우승할까?", deadline);
    await tx.wait();
    marketId = 0n;
  });

  describe("createMarket()", () => {
    it("오너만 시장을 생성할 수 있다", async () => {
      await expect(
        polyPredict.connect(alice).createMarket("테스트", deadline + 100)
      ).to.be.revertedWithCustomError(polyPredict, "OwnableUnauthorizedAccount");
    });

    it("과거 마감일로 시장 생성 불가", async () => {
      const pastDeadline = (await networkHelpers.time.latest()) - 1;
      await expect(polyPredict.createMarket("테스트", pastDeadline)).to.be.revertedWith(
        "Deadline must be in the future"
      );
    });

    it("시장이 올바르게 생성된다", async () => {
      const market = await polyPredict.getMarket(marketId);
      expect(market.question).to.equal("바이에른 뮌헨이 우승할까?");
      expect(market.state).to.equal(0);
    });
  });

  describe("mintShares()", () => {
    beforeEach(async () => {
      await usdc.connect(alice).approve(await polyPredict.getAddress(), USDC(100));
    });

    it("1 USDC 예치 시 YES 1개 + NO 1개 발행", async () => {
      await polyPredict.connect(alice).mintShares(marketId, USDC(1));

      const [yes, no] = await polyPredict.getShareBalances(marketId, alice.address);
      expect(yes).to.equal(USDC(1));
      expect(no).to.equal(USDC(1));
    });

    it("USDC가 컨트랙트로 이동된다", async () => {
      const before = await usdc.balanceOf(alice.address);
      await polyPredict.connect(alice).mintShares(marketId, USDC(50));
      const after = await usdc.balanceOf(alice.address);
      expect(before - after).to.equal(USDC(50));
    });

    it("마감 이후 베팅 불가 (엣지 케이스)", async () => {
      await networkHelpers.time.increaseTo(deadline + 1);
      await expect(
        polyPredict.connect(alice).mintShares(marketId, USDC(1))
      ).to.be.revertedWith("Betting deadline passed");
    });

    it("승인 없이 mintShares 불가", async () => {
      await expect(polyPredict.connect(bob).mintShares(marketId, USDC(1))).to.revert(ethers);
    });
  });

  describe("resolveMarket()", () => {
    beforeEach(async () => {
      await usdc.connect(alice).approve(await polyPredict.getAddress(), USDC(100));
      await polyPredict.connect(alice).mintShares(marketId, USDC(100));
      await networkHelpers.time.increaseTo(deadline + 1);
    });

    it("Owner가 아니면 결과를 확정할 수 없다", async () => {
      await expect(polyPredict.connect(alice).resolveMarket(marketId, 1)).to.be.revertedWithCustomError(
        polyPredict,
        "OwnableUnauthorizedAccount"
      );
    });

    it("마감 전에 resolve 불가 (엣지 케이스)", async () => {
      const futureDeadline = (await networkHelpers.time.latest()) + 3600;
      await polyPredict.createMarket("새 시장", futureDeadline);
      await expect(polyPredict.resolveMarket(1n, 1)).to.be.revertedWith("Deadline not reached yet");
    });

    it("YES 결과로 정상 확정된다", async () => {
      await polyPredict.connect(owner).resolveMarket(marketId, 1);
      const market = await polyPredict.getMarket(marketId);
      expect(market.state).to.equal(2);
      expect(market.outcome).to.equal(1);
    });
  });

  describe("claimWinnings()", () => {
    beforeEach(async () => {
      await usdc.connect(alice).approve(await polyPredict.getAddress(), USDC(100));
      await polyPredict.connect(alice).mintShares(marketId, USDC(100));

      await usdc.connect(bob).approve(await polyPredict.getAddress(), USDC(200));
      await polyPredict.connect(bob).mintShares(marketId, USDC(200));

      await networkHelpers.time.increaseTo(deadline + 1);
      await polyPredict.connect(owner).resolveMarket(marketId, 1);
    });

    it("YES 승리 시 Alice는 100 USDC 수령", async () => {
      const before = await usdc.balanceOf(alice.address);
      await polyPredict.connect(alice).claimWinnings(marketId);
      const after = await usdc.balanceOf(alice.address);
      expect(after - before).to.equal(USDC(100));
    });

    it("YES 승리 시 Bob은 200 USDC 수령", async () => {
      const before = await usdc.balanceOf(bob.address);
      await polyPredict.connect(bob).claimWinnings(marketId);
      const after = await usdc.balanceOf(bob.address);
      expect(after - before).to.equal(USDC(200));
    });

    it("수령 후 토큰은 소각된다", async () => {
      await polyPredict.connect(alice).claimWinnings(marketId);
      const [yes, no] = await polyPredict.getShareBalances(marketId, alice.address);
      expect(yes).to.equal(0n);
      expect(no).to.equal(0n);
    });

    it("중복 수령 불가 (엣지 케이스)", async () => {
      await polyPredict.connect(alice).claimWinnings(marketId);
      await expect(polyPredict.connect(alice).claimWinnings(marketId)).to.be.revertedWith("No shares to claim");
    });

    it("미정산 시장에서 claim 불가", async () => {
      const newDeadline = (await networkHelpers.time.latest()) + 3600;
      await polyPredict.createMarket("새 시장", newDeadline);
      await expect(polyPredict.connect(alice).claimWinnings(1n)).to.be.revertedWith("Market not resolved yet");
    });
  });
});
