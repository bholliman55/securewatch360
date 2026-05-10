import { randomUUID } from "node:crypto";

/**
 * RFC-style request correlation id for logs and traces.
 */
export function newRequestCorrelationId(): string {
  return randomUUID();
}

export type IdempotencyStatus = "in_flight" | "completed";

export type IdempotencyRecord<T = unknown> = {
  key: string;
  status: IdempotencyStatus;
  result?: T;
  expires_at_ms: number;
};

/**
 * Dedupes retried deliveries — first completion wins; duplicates return the stored outcome.
 */
export class IdempotencyStore<T = unknown> {
  private readonly map = new Map<string, IdempotencyRecord<T>>();

  /**
   * Begin processing: returns `first` if this key is new, `duplicate` if already completed (with result),
   * or `in_flight` if another worker holds the lease (optional pattern — here we treat in_flight as retry-safe wait).
   */
  beginOrGet(args: { key: string; ttl_ms: number; now_ms?: number }):
    | { state: "first"; record: IdempotencyRecord<T> }
    | { state: "duplicate"; record: IdempotencyRecord<T> }
    | { state: "in_flight"; record: IdempotencyRecord<T> } {
    const now = args.now_ms ?? Date.now();
    this.prune(now);
    const existing = this.map.get(args.key);
    if (existing) {
      if (existing.status === "completed") {
        return { state: "duplicate", record: existing };
      }
      return { state: "in_flight", record: existing };
    }
    const rec: IdempotencyRecord<T> = {
      key: args.key,
      status: "in_flight",
      expires_at_ms: now + args.ttl_ms,
    };
    this.map.set(args.key, rec);
    return { state: "first", record: rec };
  }

  complete(key: string, result: T, args?: { now_ms?: number; retain_result_ms?: number }): void {
    const now = args?.now_ms ?? Date.now();
    const retain = args?.retain_result_ms ?? 300_000;
    const r = this.map.get(key);
    if (!r) return;
    r.status = "completed";
    r.result = result;
    r.expires_at_ms = now + retain;
  }

  getResult(key: string): T | undefined {
    const r = this.map.get(key);
    if (r?.status === "completed") return r.result;
    return undefined;
  }

  private prune(now: number): void {
    for (const [k, v] of this.map) {
      if (v.expires_at_ms < now) this.map.delete(k);
    }
  }

  clearForTests(): void {
    this.map.clear();
  }
}
