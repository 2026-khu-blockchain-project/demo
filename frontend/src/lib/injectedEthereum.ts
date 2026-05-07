import type { Eip1193Provider } from "ethers";

type InjectedWin = Eip1193Provider & {
  isMetaMask?: boolean;
  providers?: (Eip1193Provider & { isMetaMask?: boolean })[];
};

/** Coinbase 등과 함께 설치된 경우 `providers` 중 MetaMask를 우선 사용 */
export function getBrowserEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = (window as unknown as { ethereum?: InjectedWin }).ethereum;
  if (!raw) return undefined;
  const list = raw.providers;
  if (Array.isArray(list) && list.length > 0) {
    const mm = list.find((p) => p.isMetaMask);
    return mm ?? list[0];
  }
  return raw;
}
