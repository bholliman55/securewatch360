type EnrichmentEntry<T = unknown> = {
  value: T;
  expires_at_ms: number;
};

/**
 * Short-lived cache for third-party / LLM enrichment of entities (CVE text, geo, etc.).
 */
export class EnrichmentCache<T = unknown> {
  private readonly map = new Map<string, EnrichmentEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  private key(tenantId: string, enrichmentType: string, entityId: string): string {
    return `${tenantId}:${enrichmentType}:${entityId}`;
  }

  get(tenantId: string, enrichmentType: string, entityId: string, nowMs = Date.now()): T | undefined {
    const k = this.key(tenantId, enrichmentType, entityId);
    const e = this.map.get(k);
    if (!e || e.expires_at_ms < nowMs) {
      if (e) this.map.delete(k);
      return undefined;
    }
    return e.value;
  }

  set(
    tenantId: string,
    enrichmentType: string,
    entityId: string,
    value: T,
    ttlMs?: number,
    nowMs = Date.now(),
  ): void {
    const k = this.key(tenantId, enrichmentType, entityId);
    this.map.set(k, {
      value,
      expires_at_ms: nowMs + (ttlMs ?? this.defaultTtlMs),
    });
  }

  clearForTests(): void {
    this.map.clear();
  }
}
