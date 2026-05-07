import "dotenv/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

function amoyAccounts(): string[] {
  const raw = process.env.PRIVATE_KEY?.trim();
  if (!raw) return [];
  const pk = raw.startsWith("0x") ? raw : `0x${raw}`;
  return [pk];
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: "0.8.28",
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    localhost: {
      type: "http",
      chainType: "generic",
      url: "http://127.0.0.1:8545",
      accounts: "remote",
    },
    amoy: {
      type: "http",
      chainType: "generic",
      url:
        process.env.AMOY_RPC_URL?.trim() ||
        "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: amoyAccounts(),
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.POLYGONSCAN_API_KEY ?? "",
    },
  },
});
