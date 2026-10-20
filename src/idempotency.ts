export type StoredResult = { status: number; body: unknown; digest?: string; expiresAt: number };
export type IdempotentResult = { status: number; body: unknown };

export class IdempotencyConflictError extends Error {
  constructor() {
    super("idempotency key was already used for a different request");
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyStore {
  private readonly values = new Map<string, StoredResult>();
  private readonly inflight = new Map<string, { digest: string; promise: Promise<IdempotentResult> }>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number, now = () => Date.now()) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: string): StoredResult | undefined {
    const value = this.values.get(key);
    if (!value || value.expiresAt <= this.now()) {
      if (value) this.values.delete(key);
      return undefined;
    }
    return value;
  }

  set(key: string, result: Omit<StoredResult, "expiresAt">): void {
    this.values.set(key, { ...result, expiresAt: this.now() + this.ttlMs });
  }

  /**
   * Runs `task` at most once per key and request digest. A stored or in-flight
   * result is returned for the same digest; a different digest under the same
   * key is rejected with IdempotencyConflictError. Failed tasks are not stored.
   */
  execute(key: string, digest: string, task: () => Promise<IdempotentResult>): Promise<IdempotentResult> {
    const stored = this.get(key);
    if (stored) {
      if (stored.digest !== undefined && stored.digest !== digest) return Promise.reject(new IdempotencyConflictError());
      return Promise.resolve({ status: stored.status, body: stored.body });
    }
    const running = this.inflight.get(key);
    if (running) {
      if (running.digest !== digest) return Promise.reject(new IdempotencyConflictError());
      return running.promise;
    }
    const promise = task()
      .then((result) => {
        this.set(key, { ...result, digest });
        return result;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, { digest, promise });
    return promise;
  }

  size(): number {
    return this.values.size;
  }
}
