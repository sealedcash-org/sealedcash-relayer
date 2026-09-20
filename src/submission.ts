import { createHash, timingSafeEqual } from "node:crypto";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { RelayerConfig } from "./config.js";

export type WithdrawalRequest = { calldata: Hex; value: bigint };
export type SubmissionResult = { transactionHash: Hex; blockHash: Hex; gasUsed: bigint };
export type SubmissionClient = (request: WithdrawalRequest) => Promise<SubmissionResult>;

export function requestHash(request: WithdrawalRequest): string {
  return createHash("sha256")
    .update(`${request.calldata.toLowerCase()}:${request.value}`)
    .digest("hex");
}

export function tokensMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createViemSubmissionClient(config: RelayerConfig): SubmissionClient {
  const account = privateKeyToAccount(config.SEALEDCASH_RELAYER_KEY as `0x${string}`);
  const transport = http(config.SEALEDCASH_RPC_URL, { timeout: 8000 });
  const chain = {
    id: config.SEALEDCASH_CHAIN_ID,
    name: "Configured SealedCash network",
    nativeCurrency: { name: "Native token", symbol: "NATIVE", decimals: 18 },
    rpcUrls: { default: { http: [config.SEALEDCASH_RPC_URL] } }
  } as const;
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  return async (request) => {
    const chainId = await publicClient.getChainId();
    if (chainId !== config.SEALEDCASH_CHAIN_ID) throw new Error("configured chain ID does not match RPC");
    const gas = await publicClient.estimateGas({
      account,
      to: config.SEALEDCASH_POOL_ADDRESS as Hex,
      data: request.calldata,
      value: request.value
    });
    if (gas > config.SEALEDCASH_MAX_GAS) throw new Error("estimated gas exceeds configured limit");
    const transactionHash = await walletClient.sendTransaction({
      account,
      to: config.SEALEDCASH_POOL_ADDRESS as Hex,
      data: request.calldata,
      value: request.value,
      gas
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (receipt.status !== "success") throw new Error("withdrawal transaction reverted");
    return { transactionHash, blockHash: receipt.blockHash, gasUsed: receipt.gasUsed };
  };
}