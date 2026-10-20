import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { readConfig, isConfigured, type RelayerConfig } from "./config.js";
import { IdempotencyConflictError, IdempotencyStore } from "./idempotency.js";
import { validateWithdrawalCalldata, RelayerPolicyError } from "./policy.js";
import { createViemSubmissionClient, requestHash, tokensMatch, type SubmissionClient } from "./submission.js";

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
};

async function body(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 400_000) throw new RelayerPolicyError("request body too large");
  }
  try { return JSON.parse(raw); } catch { throw new RelayerPolicyError("invalid JSON"); }
}

export function createRelayerServer(options?: { config?: RelayerConfig; submit?: SubmissionClient }) {
  const config = options?.config ?? (isConfigured() ? readConfig() : undefined);
  const store = new IdempotencyStore(config?.SEALEDCASH_IDEMPOTENCY_TTL_MS ?? 900_000);
  const submit = options?.submit ?? (config ? createViemSubmissionClient(config) : undefined);
  let queue: Promise<void> = Promise.resolve();
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/healthz") return json(response, 200, { status: "ok", service: "sealedcash-relayer" });
      if (request.method === "GET" && request.url === "/readyz") {
        return json(response, config && submit ? 200 : 503, { status: config && submit ? "ready" : "not_ready", service: "sealedcash-relayer" });
      }
      if (request.method !== "POST" || request.url !== "/v1/withdraw") return json(response, 404, { error: "not_found" });
      if (!config || !submit) return json(response, 503, { error: "relayer_not_configured" });
      const authorization = request.headers.authorization ?? "";
      if (!authorization.startsWith("Bearer ") || !tokensMatch(config.SEALEDCASH_SERVICE_TOKEN, authorization.slice(7))) return json(response, 401, { error: "unauthorized" });
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || !/^[\x21-\x7e]{16,128}$/.test(idempotencyKey)) return json(response, 400, { error: "invalid_idempotency_key" });
      const parsed = await body(request);
      if (!parsed || typeof parsed !== "object") throw new RelayerPolicyError();
      const candidate = parsed as Record<string, unknown>;
      const calldata = validateWithdrawalCalldata(candidate.calldata);
      const valueText = String(candidate.value ?? "0");
      if (!/^(0|[1-9][0-9]*)$/.test(valueText)) throw new RelayerPolicyError();
      const value = BigInt(valueText);
      if (value !== 0n) throw new RelayerPolicyError();
      const operation = { calldata, value } as const;
      const digest = requestHash(operation);
      const logId = createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 12);
      const outcome = await store.execute(idempotencyKey, digest, async () => {
        console.info(JSON.stringify({ event: "withdrawal_accepted", request: logId, operation: "withdraw", digest }));
        const run = queue.then(() => submit(operation));
        queue = run.then(() => undefined, () => undefined);
        const result = await run;
        return { status: 200, body: { transactionHash: result.transactionHash, blockHash: result.blockHash, gasUsed: result.gasUsed.toString() } };
      });
      return json(response, outcome.status, outcome.body);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        console.warn(JSON.stringify({ event: "withdrawal_rejected", reason: "idempotency_key_reused" }));
        return json(response, 422, { error: "idempotency_key_reused" });
      }
      const status = error instanceof RelayerPolicyError ? 400 : 502;
      console.warn(JSON.stringify({ event: "withdrawal_rejected", reason: error instanceof RelayerPolicyError ? "invalid_request" : "submission_failed" }));
      return json(response, status, { error: status === 400 ? "invalid_request" : "submission_failed" });
    }
  });
}

if (process.argv[1]?.endsWith("/server.js")) {
  const config = readConfig();
  createRelayerServer({ config }).listen(config.PORT, () => console.info(JSON.stringify({ event: "listening", port: config.PORT })));
}