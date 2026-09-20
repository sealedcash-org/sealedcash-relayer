import { decodeFunctionData, parseAbi, type Hex } from "viem";

const poolAbi = parseAbi([
  "function withdraw(bytes32 root,bytes32[2] inputNullifiers,uint8 inputCount,address asset,uint256 amount,address recipient,address relayer,uint256 relayerFee,bytes32[2] outputCommitments,uint8 outputCount,bytes[2] encryptedOutputs,bytes proof)"
]);

const hex = (value: unknown): value is Hex =>
  typeof value === "string" && /^0x[0-9a-f]*$/i.test(value);

export class RelayerPolicyError extends Error {
  constructor(message = "relayer request rejected") {
    super(message);
    this.name = "RelayerPolicyError";
  }
}

export function validateWithdrawalCalldata(calldata: unknown): Hex {
  if (!hex(calldata) || calldata.length < 10 || calldata.length > 200_000) {
    throw new RelayerPolicyError();
  }
  try {
    const decoded = decodeFunctionData({ abi: poolAbi, data: calldata });
    if (decoded.functionName !== "withdraw") throw new RelayerPolicyError();
    return calldata;
  } catch {
    throw new RelayerPolicyError();
  }
}