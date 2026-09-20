import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdempotencyStore } from "./idempotency.ts";

describe("idempotency store", () => {
  it("expires entries", () => {
    let now = 100;
    const store = new IdempotencyStore(10, () => now);
    store.set("key", { status: 200, body: { ok: true } });
    assert.deepEqual(store.get("key")?.body, { ok: true });
    now = 111;
    assert.equal(store.get("key"), undefined);
  });
});