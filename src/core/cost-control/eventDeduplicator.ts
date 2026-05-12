import { createHash } from "node:crypto";

function stableSortedJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Collapses bursty duplicate agent / pipeline events within a TTL window.
 */
export class EventDeduplicator {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  fingerprint(args: {
    tenant_id: string;
    event_kind: string;
    /** Normalized payload subset used for dedup identity. */
    payload: Record<string, unknown>;
  }): string {
    const body = stableSortedJson({
      tenant_id: args.tenant_id,
      event_kind: args.event_kind,
      payload: args.payload,
    });
    return createHash("sha256").update(body, "utf8").digest("hex");
  }

  /** Returns true if this fingerprint was already seen within TTL (duplicate). */
  isDuplicate(fingerprint: string, nowMs = Date.now()): boolean {
    this.prune(nowMs);
    if (this.seen.has(fingerprint)) return true;
    this.seen.set(fingerprint, nowMs + this.ttlMs);
    return false;
  }

  private prune(nowMs: number): void {
    for (const [k, exp] of this.seen) {
      if (exp < nowMs) this.seen.delete(k);
    }
  }

  clearForTests(): void {
    this.seen.clear();
  }
}
