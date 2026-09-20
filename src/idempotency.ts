export type StoredResult = { status: number; body: unknown; expiresAt: number };

export class IdempotencyStore {
  private readonly values = new Map<string, StoredResult>();
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

  size(): number {
    return this.values.size;
  }
}