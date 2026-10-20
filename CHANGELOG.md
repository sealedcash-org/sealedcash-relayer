# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- Reject an `Idempotency-Key` reused with different calldata (`422
  idempotency_key_reused`) instead of returning the earlier result, and submit
  concurrent requests that share a key and body only once.

## [0.1.0] - 2025-01-01

- Added authenticated health, readiness, and withdrawal submission endpoints.
- Added strict pool calldata policy, idempotency protection, and serialized RPC
  submission.
- Added tests and a tagged release workflow.