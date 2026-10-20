import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdempotencyConflictError, IdempotencyStore } from "./idempotency.ts";

describe("idempotency store", () => {
  it("expires entries", () => {
    let now = 100;
    const store = new IdempotencyStore(10, () => now);
    store.set("key", { status: 200, body: { ok: true } });
    assert.deepEqual(store.get("key")?.body, { ok: true });
    now = 111;
    assert.equal(store.get("key"), undefined);
  });

  it("runs concurrent requests with the same key and digest once", async () => {
    const store = new IdempotencyStore(1000);
    let runs = 0;
    const task = async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: 200, body: { run: runs } };
    };
    const [first, second] = await Promise.all([store.execute("key", "a", task), store.execute("key", "a", task)]);
    assert.equal(runs, 1);
    assert.deepEqual(first, second);
    assert.deepEqual(await store.execute("key", "a", task), first);
    assert.equal(runs, 1);
  });

  it("rejects a key reused for a different request", async () => {
    const store = new IdempotencyStore(1000);
    const task = async () => ({ status: 200, body: { ok: true } });
    const pending = store.execute("key", "a", task);
    await assert.rejects(store.execute("key", "b", task), IdempotencyConflictError);
    await pending;
    await assert.rejects(store.execute("key", "b", task), IdempotencyConflictError);
  });

  it("does not store a failed run", async () => {
    const store = new IdempotencyStore(1000);
    await assert.rejects(store.execute("key", "a", async () => { throw new Error("rpc down"); }));
    assert.deepEqual(await store.execute("key", "a", async () => ({ status: 200, body: { ok: true } })), { status: 200, body: { ok: true } });
  });
});
