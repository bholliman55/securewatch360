import type { BudgetAlert, SpendRecord, TokenBudgetPolicy } from "./tokenBudget.schema";
import { spendRecordSchema, tokenBudgetPolicySchema } from "./tokenBudget.schema";

type Totals = { tokens: number; usd: number };

type HourlyBucket = {
  window_id: number;
  tokens: number;
  usd: number;
};

function hourWindowId(nowMs: number): number {
  return Math.floor(nowMs / (60 * 60 * 1000));
}

/**
 * Tracks estimated tokens and USD by tenant, incident, agent, and simulation; emits warn/block alerts.
 */
export class TokenBudgetManager {
  private readonly policy: TokenBudgetPolicy;
  private readonly tenantHourly = new Map<string, HourlyBucket>();
  private readonly agentHourly = new Map<string, HourlyBucket>();
  private readonly incidentTotals = new Map<string, Totals>();
  private readonly simulationTotals = new Map<string, Totals>();
  private readonly loopCounters = new Map<string, { window_start: number; count: number }>();

  constructor(policy: Partial<TokenBudgetPolicy> = {}) {
    this.policy = tokenBudgetPolicySchema.parse({
      tenant_max_tokens_per_hour: 2_000_000,
      tenant_max_usd_per_hour: 200,
      incident_max_tokens_total: 500_000,
      incident_max_usd_total: 50,
      agent_max_tokens_per_hour: 800_000,
      agent_max_usd_per_hour: 80,
      simulation_max_tokens_total: 300_000,
      simulation_max_usd_total: 30,
      warn_threshold_fraction: 0.85,
      high_cost_model_usd_approval_threshold: 0.25,
      ...policy,
    });
  }

  /**
   * Runaway guard — same loop key (e.g. Inngest run id) may only advance a bounded number of AI steps per window.
   */
  recordLoopIteration(loopKey: string, args?: { now_ms?: number; max_steps?: number; window_ms?: number }): {
    ok: boolean;
    reason?: string;
  } {
    const now = args?.now_ms ?? Date.now();
    const max = args?.max_steps ?? 48;
    const windowMs = args?.window_ms ?? 5 * 60 * 1000;
    const win = Math.floor(now / windowMs);
    const cur = this.loopCounters.get(loopKey);
    if (!cur || cur.window_start !== win) {
      this.loopCounters.set(loopKey, { window_start: win, count: 1 });
      return { ok: true };
    }
    if (cur.count >= max) {
      return { ok: false, reason: "runaway_loop_budget_exceeded" };
    }
    cur.count += 1;
    return { ok: true };
  }

  /**
   * Validates spend against caps, mutates counters when `commit` is true.
   */
  evaluateSpend(record: SpendRecord, commit: boolean, nowMs?: number): {
    allowed: boolean;
    alerts: BudgetAlert[];
    force_low_cost_model: boolean;
  } {
    const r = spendRecordSchema.parse(record);
    const now = nowMs ?? Date.now();
    const alerts: BudgetAlert[] = [];
    const frac = this.policy.warn_threshold_fraction;

    const tenantBucket = this.ensureHourly(this.tenantHourly, r.tenant_id, now);
    const tenantTokensAfter = tenantBucket.tokens + r.prompt_tokens + r.completion_tokens;
    const tenantUsdAfter = tenantBucket.usd + r.estimated_usd;

    this.pushWarn(
      alerts,
      "tenant",
      r.tenant_id,
      tenantTokensAfter / this.policy.tenant_max_tokens_per_hour,
      frac,
      now,
      "Tenant hourly token budget",
    );
    this.pushWarn(
      alerts,
      "tenant",
      r.tenant_id,
      tenantUsdAfter / this.policy.tenant_max_usd_per_hour,
      frac,
      now,
      "Tenant hourly USD budget",
    );

    let block = false;
    if (tenantTokensAfter > this.policy.tenant_max_tokens_per_hour) {
      block = true;
      alerts.push({
        scope: "tenant",
        level: "block",
        message: "Tenant hourly token cap exceeded",
        at_ms: now,
        tenant_id: r.tenant_id,
      });
    }
    if (tenantUsdAfter > this.policy.tenant_max_usd_per_hour) {
      block = true;
      alerts.push({
        scope: "tenant",
        level: "block",
        message: "Tenant hourly USD cap exceeded",
        at_ms: now,
        tenant_id: r.tenant_id,
      });
    }

    let incidentTokensAfter = 0;
    let incidentUsdAfter = 0;
    if (r.incident_id) {
      const k = `${r.tenant_id}:${r.incident_id}`;
      const inc = this.incidentTotals.get(k) ?? { tokens: 0, usd: 0 };
      incidentTokensAfter = inc.tokens + r.prompt_tokens + r.completion_tokens;
      incidentUsdAfter = inc.usd + r.estimated_usd;
      this.pushWarn(
        alerts,
        "incident",
        r.tenant_id,
        incidentTokensAfter / this.policy.incident_max_tokens_total,
        frac,
        now,
        "Incident token budget",
      );
      this.pushWarn(
        alerts,
        "incident",
        r.tenant_id,
        incidentUsdAfter / this.policy.incident_max_usd_total,
        frac,
        now,
        "Incident USD budget",
      );
      if (incidentTokensAfter > this.policy.incident_max_tokens_total) {
        block = true;
        alerts.push({
          scope: "incident",
          level: "block",
          message: "Incident token cap exceeded",
          at_ms: now,
          tenant_id: r.tenant_id,
        });
      }
      if (incidentUsdAfter > this.policy.incident_max_usd_total) {
        block = true;
        alerts.push({
          scope: "incident",
          level: "block",
          message: "Incident USD cap exceeded",
          at_ms: now,
          tenant_id: r.tenant_id,
        });
      }
    }

    let agentTokensAfter = 0;
    let agentUsdAfter = 0;
    if (r.agent_id) {
      const agentBucket = this.ensureHourly(this.agentHourly, `${r.tenant_id}:${r.agent_id}`, now);
      agentTokensAfter = agentBucket.tokens + r.prompt_tokens + r.completion_tokens;
      agentUsdAfter = agentBucket.usd + r.estimated_usd;
      this.pushWarn(
        alerts,
        "agent",
        r.tenant_id,
        agentTokensAfter / this.policy.agent_max_tokens_per_hour,
        frac,
        now,
        "Agent hourly token budget",
      );
      this.pushWarn(
        alerts,
        "agent",
        r.tenant_id,
        agentUsdAfter / this.policy.agent_max_usd_per_hour,
        frac,
        now,
        "Agent hourly USD budget",
      );
      if (agentTokensAfter > this.policy.agent_max_tokens_per_hour) {
        block = true;
        alerts.push({
          scope: "agent",
          level: "block",
          message: "Agent hourly token cap exceeded",
          at_ms: now,
          tenant_id: r.tenant_id,
        });
      }
      if (agentUsdAfter > this.policy.agent_max_usd_per_hour) {
        block = true;
        alerts.push({
          scope: "agent",
          level: "block",
          message: "Agent hourly USD cap exceeded",
          at_ms: now,
          tenant_id: r.tenant_id,
        });
      }
    }

    let simTokensAfter = 0;
    let simUsdAfter = 0;
    if (r.simulation_run_id) {
      const sk = `${r.tenant_id}:${r.simulation_run_id}`;
      const sim = this.simulationTotals.get(sk) ?? { tokens: 0, usd: 0 };
      simTokensAfter = sim.tokens + r.prompt_tokens + r.completion_tokens;
      simUsdAfter = sim.usd + r.estimated_usd;
      this.pushWarn(
        alerts,
        "simulation",
        r.tenant_id,
        simTokensAfter / this.policy.simulation_max_tokens_total,
        frac,
        now,
        "Simulation token budget",
      );
      this.pushWarn(
        alerts,
        "simulation",
        r.tenant_id,
        simUsdAfter / this.policy.simulation_max_usd_total,
        frac,
        now,
        "Simulation USD budget",
      );
      if (simTokensAfter > this.policy.simulation_max_tokens_total) {
        block = true;
        alerts.push({
          scope: "simulation",
          level: "block",
          message: "Simulation token cap exceeded",
          at_ms: now,
          tenant_id: r.tenant_id,
        });
      }
      if (simUsdAfter > this.policy.simulation_max_usd_total) {
        block = true;
        alerts.push({
          scope: "simulation",
          level: "block",
          message: "Simulation USD cap exceeded",
          at_ms: now,
          tenant_id: r.tenant_id,
        });
      }
    }

    const force_low_cost_model = Boolean(
      tenantTokensAfter / this.policy.tenant_max_tokens_per_hour >= frac ||
        tenantUsdAfter / this.policy.tenant_max_usd_per_hour >= frac ||
        (Boolean(r.incident_id) &&
          incidentTokensAfter / this.policy.incident_max_tokens_total >= frac) ||
        (Boolean(r.agent_id) && agentTokensAfter / this.policy.agent_max_tokens_per_hour >= frac) ||
        (Boolean(r.simulation_run_id) && simTokensAfter / this.policy.simulation_max_tokens_total >= frac),
    );

    if (commit && !block) {
      tenantBucket.tokens = tenantTokensAfter;
      tenantBucket.usd = tenantUsdAfter;
      if (r.incident_id) {
        const k = `${r.tenant_id}:${r.incident_id}`;
        this.incidentTotals.set(k, { tokens: incidentTokensAfter, usd: incidentUsdAfter });
      }
      if (r.agent_id) {
        const agentBucket = this.ensureHourly(this.agentHourly, `${r.tenant_id}:${r.agent_id}`, now);
        agentBucket.tokens = agentTokensAfter;
        agentBucket.usd = agentUsdAfter;
      }
      if (r.simulation_run_id) {
        const sk = `${r.tenant_id}:${r.simulation_run_id}`;
        this.simulationTotals.set(sk, { tokens: simTokensAfter, usd: simUsdAfter });
      }
    }

    return { allowed: !block, alerts, force_low_cost_model };
  }

  getPolicy(): TokenBudgetPolicy {
    return this.policy;
  }

  private ensureHourly(map: Map<string, HourlyBucket>, id: string, nowMs: number): HourlyBucket {
    const wid = hourWindowId(nowMs);
    const cur = map.get(id);
    if (!cur || cur.window_id !== wid) {
      const b: HourlyBucket = { window_id: wid, tokens: 0, usd: 0 };
      map.set(id, b);
      return b;
    }
    return cur;
  }

  private pushWarn(
    alerts: BudgetAlert[],
    scope: BudgetAlert["scope"],
    tenant_id: string,
    ratio: number,
    frac: number,
    at_ms: number,
    label: string,
  ): void {
    if (ratio >= frac && ratio < 1) {
      alerts.push({
        scope,
        level: "warn",
        message: `${label} at ${(ratio * 100).toFixed(1)}% of cap`,
        at_ms,
        tenant_id,
      });
    }
  }

  clearForTests(): void {
    this.tenantHourly.clear();
    this.agentHourly.clear();
    this.incidentTotals.clear();
    this.simulationTotals.clear();
    this.loopCounters.clear();
  }
}
