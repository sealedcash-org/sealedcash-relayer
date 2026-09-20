import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeFunctionData, parseAbi } from "viem";
import { validateWithdrawalCalldata } from "./policy.ts";

const zero = `0x${"0".repeat(64)}` as const;
const calldata = encodeFunctionData({
  abi: parseAbi(["function withdraw(bytes32,bytes32[2],uint8,address,uint256,address,address,uint256,bytes32[2],uint8,bytes[2],bytes)"]),
  functionName: "withdraw",
  args: [zero, [zero, zero], 1, "0x0000000000000000000000000000000000000001", 0n, "0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000001", 0n, [zero, zero], 0, ["0x", "0x"], "0x"]
});

describe("withdrawal policy", () => {
  it("accepts the pool withdrawal selector", () => assert.equal(validateWithdrawalCalldata(calldata), calldata));
  it("rejects arbitrary calldata", () => assert.throws(() => validateWithdrawalCalldata("0x1234")));
});