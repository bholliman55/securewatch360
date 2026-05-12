import { createHash } from "node:crypto";

type CacheEntry = {
  summary: string;
  saved_tokens_estimate: number;
  expires_at_ms: number;
};

function hashKey(tenantId: string, text: string): string {
  return createHash("sha256").update(`${tenantId}|${text}`, "utf8").digest("hex");
}

/**
 * Deduplicates expensive summarization — callers supply estimated tokens avoided on hit.
 */
export class SummarizationCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly defaultTtlMs: number) {}

  get(tenantId: string, sourceText: string, nowMs = Date.now()): CacheEntry | undefined {
    const k = hashKey(tenantId, sourceText);
    const e = this.map.get(k);
    if (!e || e.expires_at_ms < nowMs) {
      if (e) this.map.delete(k);
      return undefined;
    }
    return e;
  }

  set(tenantId: string, sourceText: string, summary: string, savedTokensEstimate: number, ttlMs?: number, nowMs = Date.now()): void {
    const k = hashKey(tenantId, sourceText);
    this.map.set(k, {
      summary,
      saved_tokens_estimate: savedTokensEstimate,
      expires_at_ms: nowMs + (ttlMs ?? this.defaultTtlMs),
    });
  }

  clearForTests(): void {
    this.map.clear();
  }
}
