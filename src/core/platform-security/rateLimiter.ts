/**
 * Fixed-window counter rate limiter — suitable per API route + tenant or IP key.
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  reset_at_ms: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, { window_start: number; count: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxPerWindow: number,
  ) {}

  allow(key: string, nowMs = Date.now()): RateLimitResult {
    const b = this.buckets.get(key);
    if (!b || nowMs - b.window_start >= this.windowMs) {
      this.buckets.set(key, { window_start: nowMs, count: 1 });
      return {
        ok: true,
        remaining: this.maxPerWindow - 1,
        reset_at_ms: nowMs + this.windowMs,
      };
    }
    if (b.count >= this.maxPerWindow) {
      return {
        ok: false,
        remaining: 0,
        reset_at_ms: b.window_start + this.windowMs,
      };
    }
    b.count += 1;
    return {
      ok: true,
      remaining: this.maxPerWindow - b.count,
      reset_at_ms: b.window_start + this.windowMs,
    };
  }

  clearForTests(): void {
    this.buckets.clear();
  }
}
