/**
 * In-memory cache + per-tenant / global rate limits for Bright Data MCP calls.
 * For multi-instance production, replace with Redis or a shared limiter service.
 */

export type BrightDataRateLimiterConfig = {
  /** Max completed MCP operations per tenant per sliding minute window. */
  maxPerTenantPerMinute: number;
  /** Hard cap across all tenants in this process (optional safety valve). */
  maxGlobalPerMinute: number;
  /** Default TTL for cached identical requests. */
  defaultCacheTtlMs: number;
};

type MinuteCounter = { minuteEpoch: number; count: number };

type CacheEntry = { expiresAtMs: number; payload: unknown };

const DEFAULT_CONFIG: BrightDataRateLimiterConfig = {
  maxPerTenantPerMinute: 30,
  maxGlobalPerMinute: 120,
  defaultCacheTtlMs: 120_000,
};

function currentMinuteEpoch(): number {
  return Math.floor(Date.now() / 60_000);
}

export class BrightDataRateLimiter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly tenantCounters = new Map<string, MinuteCounter>();
  private globalCounter: MinuteCounter = { minuteEpoch: -1, count: 0 };

  constructor(private readonly cfg: BrightDataRateLimiterConfig = DEFAULT_CONFIG) {}

  clearForTests(): void {
    this.cache.clear();
    this.tenantCounters.clear();
    this.globalCounter = { minuteEpoch: -1, count: 0 };
  }

  private consumeGlobal(): void {
    const m = currentMinuteEpoch();
    if (this.globalCounter.minuteEpoch !== m) {
      this.globalCounter = { minuteEpoch: m, count: 0 };
    }
    if (this.globalCounter.count >= this.cfg.maxGlobalPerMinute) {
      throw new BrightDataRateLimitExceededError(
        "Bright Data global rate limit exceeded for this minute window",
      );
    }
    this.globalCounter.count += 1;
  }

  private consumeTenant(tenantId: string): void {
    const m = currentMinuteEpoch();
    let row = this.tenantCounters.get(tenantId);
    if (!row || row.minuteEpoch !== m) {
      row = { minuteEpoch: m, count: 0 };
      this.tenantCounters.set(tenantId, row);
    }
    if (row.count >= this.cfg.maxPerTenantPerMinute) {
      throw new BrightDataRateLimitExceededError(
        "Bright Data tenant rate limit exceeded for this minute window",
      );
    }
    row.count += 1;
  }

  /**
   * Returns cached payload when key is fresh; otherwise runs `fn`, caches, and enforces limits.
   */
  async withCacheAndLimit<T>(options: {
    tenantId: string;
    cacheKey: string;
    cacheTtlMs?: number;
    skipCache?: boolean;
    fn: () => Promise<T>;
  }): Promise<T> {
    const now = Date.now();
    const ttl = options.cacheTtlMs ?? this.cfg.defaultCacheTtlMs;
    const fullKey = `${options.tenantId}::${options.cacheKey}`;

    if (!options.skipCache) {
      const hit = this.cache.get(fullKey);
      if (hit && hit.expiresAtMs > now) {
        return hit.payload as T;
      }
    }

    this.consumeGlobal();
    this.consumeTenant(options.tenantId);

    const payload = await options.fn();
    this.cache.set(fullKey, { expiresAtMs: now + ttl, payload });
    return payload;
  }
}

export class BrightDataRateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrightDataRateLimitExceededError";
  }
}
