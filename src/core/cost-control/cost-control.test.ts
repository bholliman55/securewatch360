import { describe, expect, it } from "vitest";
import { EnrichmentCache } from "./enrichmentCache";
import { EventDeduplicator } from "./eventDeduplicator";
import { routeModelByTaskComplexity } from "./modelCostRouter";
import { SummarizationCache } from "./summarizationCache";
import { TokenBudgetManager } from "./tokenBudgetManager";

const TENANT = "11111111-1111-4111-8111-111111111111";

describe("cost-control", () => {
  it("routes cheaper models when forced low-cost tier", () => {
    const r = routeModelByTaskComplexity({
      complexity: "complex",
      force_low_cost_tier: true,
      estimated_call_usd: 0.01,
      high_cost_usd_approval_threshold: 0.25,
    });
    expect(r.primary_model).toContain("nano");
    expect(r.prefer_low_cost).toBe(true);
  });

  it("blocks tenant spend when caps are exceeded and surfaces alerts", () => {
    const mgr = new TokenBudgetManager({
      tenant_max_tokens_per_hour: 1000,
      tenant_max_usd_per_hour: 5,
      incident_max_tokens_total: 1_000_000,
      incident_max_usd_total: 500,
      agent_max_tokens_per_hour: 1_000_000,
      agent_max_usd_per_hour: 500,
      simulation_max_tokens_total: 1_000_000,
      simulation_max_usd_total: 500,
      warn_threshold_fraction: 0.5,
    });
    const base = {
      tenant_id: TENANT,
      prompt_tokens: 400,
      completion_tokens: 100,
      estimated_usd: 1,
      recorded_at_ms: Date.now(),
    };
    const first = mgr.evaluateSpend({ ...base }, true);
    expect(first.allowed).toBe(true);
    const second = mgr.evaluateSpend({ ...base, prompt_tokens: 600, completion_tokens: 0 }, false);
    expect(second.allowed).toBe(false);
    expect(second.alerts.some((a) => a.level === "block")).toBe(true);
  });

  it("prevents runaway loop iterations", () => {
    const mgr = new TokenBudgetManager({});
    const key = "loop:inngest:job-1";
    for (let i = 0; i < 5; i++) {
      expect(mgr.recordLoopIteration(key, { max_steps: 5, window_ms: 60_000 }).ok).toBe(true);
    }
    expect(mgr.recordLoopIteration(key, { max_steps: 5, window_ms: 60_000 }).ok).toBe(false);
    expect(mgr.recordLoopIteration(key, { max_steps: 5, window_ms: 60_000 }).reason).toBe("runaway_loop_budget_exceeded");
  });

  it("deduplicates repeated events within TTL", () => {
    const d = new EventDeduplicator(60_000);
    const fp = d.fingerprint({
      tenant_id: TENANT,
      event_kind: "finding.normalized",
      payload: { id: "f-1" },
    });
    expect(d.isDuplicate(fp)).toBe(false);
    expect(d.isDuplicate(fp)).toBe(true);
  });

  it("hits summarization cache and enrichment cache", () => {
    const s = new SummarizationCache(60_000);
    s.set(TENANT, "long text", "short summary", 900);
    expect(s.get(TENANT, "long text")?.summary).toBe("short summary");
    const e = new EnrichmentCache<{ cve: string }>(60_000);
    e.set(TENANT, "cve", "CVE-2024-1", { cve: "detail" });
    expect(e.get(TENANT, "cve", "CVE-2024-1")?.cve).toBe("detail");
  });
});
