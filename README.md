# SealedCash Relayer

`@sealedcash/relayer` is a small, fail-closed HTTP service for submitting
already-constructed SealedCash pool transactions. It is an authenticated
submission boundary, not a wallet, custody service, mixer, or decentralized
network. It does not create proofs and it is not enabled for a live network
without explicit operator configuration and release checks.

The official organization is [sealedcash-org](https://github.com/sealedcash-org).
For support, contact [support@sealedcash.com](mailto:support@sealedcash.com).

## What it does

- Exposes liveness and readiness endpoints.
- Accepts only `withdraw` calldata for the configured pool address.
- Requires a bearer service token and an `Idempotency-Key`.
- Rejects malformed, oversized, replayed, or mismatched requests.
- Serializes transaction submission to keep nonce acquisition deterministic.
- Uses a configurable RPC and signer only when all required settings exist.
- Emits structured events without private keys, bearer tokens, or calldata.

## Capability and status

This repository provides a submission boundary around a configured SealedCash
pool. It is not a complete SealedCash deployment and is not live by default.
It does not generate or verify proofs, index chain state, manage user keys, or
decide whether a withdrawal is valid beyond calldata policy checks. It does not
claim decentralization, anonymity guarantees, or production readiness.

The service deliberately returns `503` while it is unconfigured. A URL and a
key alone are not evidence that a deployment is safe to enable. Operators must
independently validate the pool, proof release, chain, funding, and monitoring
before production activation.

## Architecture

The HTTP layer authenticates requests, validates a strict withdrawal shape, and
enforces an idempotency key. The policy module decodes calldata and permits
only the SealedCash `withdraw` function. The submission adapter checks the
configured chain, estimates gas against a cap, submits to the configured pool,
and waits for a successful receipt. A small in-memory store prevents replay
within the configured process lifetime; use a durable coordination layer when
running more than one instance.

## Configuration

| Variable | Example placeholder | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP listen port |
| `SEALEDCASH_SERVICE_TOKEN` | `replace-with-a-long-random-local-token` | Bearer token for trusted callers |
| `SEALEDCASH_RELAYER_KEY` | `replace-with-a-local-test-key` | Signer key supplied at runtime |
| `SEALEDCASH_RPC_URL` | `https://replace-with-an-rpc-endpoint` | Operator-selected JSON-RPC endpoint |
| `SEALEDCASH_CHAIN_ID` | `replace-with-chain-id` | Expected chain ID |
| `SEALEDCASH_POOL_ADDRESS` | `0x0000000000000000000000000000000000000000` | Expected pool target |
| `SEALEDCASH_MAX_GAS` | `800000` | Maximum estimated gas |
| `SEALEDCASH_IDEMPOTENCY_TTL_MS` | `900000` | Replay guard lifetime |
| `SEALEDCASH_LOG_LEVEL` | `info` | Reserved log verbosity setting |

All values above are placeholders. Keep runtime secrets outside source
control and never expose them to clients.

## Run locally

```sh
cp .env.example .env
npm install
npm run build
npm test
npm start
```

The example environment contains placeholders only. Never put a production
private key, RPC endpoint, contract address, or token in source control.

## HTTP API

`GET /healthz` is a process liveness check. `GET /readyz` reports whether the
service has complete configuration; it does not claim that a deployment has
passed protocol release validation.

`POST /v1/withdraw` requires:

```http
Authorization: Bearer <service-token>
Idempotency-Key: a-client-generated-unique-key
Content-Type: application/json
```

```json
{
  "calldata": "0x...",
  "value": "0"
}
```

`calldata` must encode the SealedCash pool `withdraw` function. The configured
pool address is always the transaction target. `value` is an unsigned decimal
string and must be zero for withdrawals.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability.
Contributions should follow [CONTRIBUTING.md](CONTRIBUTING.md).