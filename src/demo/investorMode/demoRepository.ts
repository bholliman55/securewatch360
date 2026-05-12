/**
 * Repository for the investor demo Supabase tables.
 *
 * Mirrors the schema created by
 * `supabase/migrations/20260508145000_create_investor_demo_tables.sql`:
 *
 *   demo_scenarios
 *   demo_clients
 *   demo_assets
 *   demo_events
 *   demo_agent_reasoning
 *   demo_actions
 *   demo_reports
 *   demo_metrics
 *
 * Design follows `src/server/voice/voiceRepository.ts`:
 *   - factory function so tests can inject a Supabase mock
 *   - best-effort error handling — every method logs and returns `null`
 *     (or `[]` / `0`) on transient failures rather than throwing, so a
 *     mid-demo Supabase hiccup never aborts a presentation
 *   - row shapes mirror the SQL columns 1:1; helpers translate camelCase
 *     input into snake_case columns
 *
 * Reuses the canonical seed snapshot from `demoSeedData.ts` so a
 * `seedDemoScenario()` call always reproduces the Acme Dental story.
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DEMO_SCENARIO_ID } from "./demoConfig";
import {
  DEMO_HEADLINE,
  DEMO_SCENARIO_META,
  DEMO_TIMELINE,
} from "./demoScenario";
import {
  INVESTOR_DEMO_SCENARIO,
  INVESTOR_DEMO_SEED_REPORT_PREFIX,
  getDemoSeed,
  type DemoSeedSnapshot,
  type InvestorDemoScenario,
} from "./demoSeedData";

// ---------------------------------------------------------------------------
// Row shapes (mirror the SQL schema 1:1)
// ---------------------------------------------------------------------------

export interface DemoScenarioRow {
  id: string;
  scenario_key: string;
  name: string;
  description: string | null;
  status: "ready" | "running" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface DemoClientRow {
  id: string;
  scenario_key: string;
  client_name: string;
  industry: string | null;
  employee_count: number | null;
  msp_name: string | null;
  compliance_frameworks: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DemoAssetRow {
  id: string;
  scenario_key: string;
  client_name: string;
  asset_name: string;
  asset_type: string;
  risk_level: "low" | "medium" | "high" | "critical";
  status:
    | "healthy"
    | "suspicious"
    | "at_risk"
    | "compromised"
    | "compromised_simulated"
    | "isolated"
    | "isolated_simulated"
    | "remediated";
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DemoEventRow {
  id: string;
  scenario_key: string;
  event_order: number;
  offset_seconds: number;
  event_type: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  agent_name: string | null;
  status: "pending" | "emitted" | "skipped";
  payload: Record<string, unknown>;
  emitted_at: string | null;
  created_at: string;
}

export interface DemoAgentReasoningRow {
  id: string;
  scenario_key: string;
  event_type: string;
  agent_name: string;
  reasoning_summary: string;
  confidence: number | null;
  evidence: unknown[];
  created_at: string;
}

export interface DemoActionRow {
  id: string;
  scenario_key: string;
  action_type: string;
  action_label: string;
  safety_level:
    | "READ_ONLY"
    | "LOW_RISK_ACTION"
    | "HIGH_RISK_ACTION"
    | "DESTRUCTIVE_ACTION";
  requires_confirmation: boolean;
  confirmed: boolean;
  status:
    | "pending"
    | "awaiting_confirmation"
    | "confirmed"
    | "executed"
    | "failed"
    | "cancelled";
  result_summary: string | null;
  created_at: string;
  executed_at: string | null;
}

export interface DemoReportRow {
  id: string;
  scenario_key: string;
  report_type: "executive" | "business_impact" | "technical" | "compliance";
  title: string;
  summary: string;
  report_json: Record<string, unknown>;
  created_at: string;
}

export interface DemoMetricRow {
  id: string;
  scenario_key: string;
  metric_key: string;
  metric_label: string;
  metric_value: string;
  sort_order: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface SeedDemoScenarioInput {
  /** Defaults to the canonical Acme Dental scenario id. */
  scenarioKey?: string;
  /** Defaults to the headline from `demoScenario.ts`. */
  name?: string;
  description?: string | null;
  /** Override the seed snapshot — defaults to `getDemoSeed()`. */
  seed?: DemoSeedSnapshot;
}

export interface EmitDemoEventInput {
  scenarioKey?: string;
  eventOrder: number;
  offsetSeconds: number;
  eventType: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  agentName?: string | null;
  payload?: Record<string, unknown>;
}

export interface UpdateDemoActionInput {
  status?: DemoActionRow["status"];
  confirmed?: boolean;
  resultSummary?: string | null;
  executedAt?: string | null;
}

export interface CreateDemoReportInput {
  scenarioKey?: string;
  reportType: DemoReportRow["report_type"];
  title: string;
  summary: string;
  reportJson?: Record<string, unknown>;
}

export interface ResetDemoScenarioResult {
  scenarioKey: string;
  ok: boolean;
  /** Number of rows that were attempted to be deleted, by table. */
  cleared: Record<
    | "demo_events"
    | "demo_agent_reasoning"
    | "demo_actions"
    | "demo_reports"
    | "demo_metrics",
    "ok" | "failed"
  >;
  error?: string;
}

// ---------------------------------------------------------------------------
// Repository surface
// ---------------------------------------------------------------------------

export interface DemoRepository {
  /** Idempotently seeds the canonical Acme Dental scenario into Supabase. */
  seedDemoScenario(input?: SeedDemoScenarioInput): Promise<{
    scenario: DemoScenarioRow | null;
    client: DemoClientRow | null;
    assets: DemoAssetRow[];
  }>;
  /** Wipes per-run state (events, reasoning, actions, reports, metrics). */
  resetDemoScenario(scenarioKey?: string): Promise<ResetDemoScenarioResult>;
  /** Returns the persisted timeline ordered by `event_order`. */
  getDemoTimeline(scenarioKey?: string): Promise<DemoEventRow[]>;
  /** Inserts a single event row with `status='emitted'` and `emitted_at=now()`. */
  emitDemoEvent(input: EmitDemoEventInput): Promise<DemoEventRow | null>;
  /** Updates a single action row by id. */
  updateDemoAction(
    actionId: string,
    input: UpdateDemoActionInput,
  ): Promise<DemoActionRow | null>;
  /** Returns metrics ordered by `sort_order`. */
  getDemoMetrics(scenarioKey?: string): Promise<DemoMetricRow[]>;
  /** Inserts a generated report row. */
  createDemoReport(input: CreateDemoReportInput): Promise<DemoReportRow | null>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function logFailure(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[demoRepository] ${scope} failed`, { error: message });
}

function getClient(client?: SupabaseClient): SupabaseClient {
  return client ?? getSupabaseAdminClient();
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createDemoRepository(supabase?: SupabaseClient): DemoRepository {
  const repo: DemoRepository = {
    async seedDemoScenario(input = {}) {
      const scenarioKey = input.scenarioKey ?? DEMO_SCENARIO_ID;
      const seed = input.seed ?? getDemoSeed();
      const name = input.name ?? DEMO_HEADLINE;
      const description = input.description ?? DEMO_SCENARIO_META.briefing;

      let scenario: DemoScenarioRow | null = null;
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_scenarios")
          .upsert(
            {
              scenario_key: scenarioKey,
              name,
              description,
              status: "ready",
            },
            { onConflict: "scenario_key" },
          )
          .select()
          .single();
        if (error) {
          logFailure("seedDemoScenario.upsertScenario", error);
        } else {
          scenario = data as DemoScenarioRow;
        }
      } catch (error) {
        logFailure("seedDemoScenario.upsertScenario", error);
      }

      let client: DemoClientRow | null = null;
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_clients")
          .insert({
            scenario_key: scenarioKey,
            client_name: seed.client.name,
            industry: seed.client.industry,
            employee_count: seed.client.employeeCount,
            msp_name: seed.client.msp,
            compliance_frameworks: [...seed.client.complianceFrameworks],
            metadata: { region: seed.client.region },
          })
          .select()
          .single();
        if (error) {
          logFailure("seedDemoScenario.insertClient", error);
        } else {
          client = data as DemoClientRow;
        }
      } catch (error) {
        logFailure("seedDemoScenario.insertClient", error);
      }

      const assets: DemoAssetRow[] = [];
      const assetSeeds: Array<{
        name: string;
        type: string;
        risk: DemoAssetRow["risk_level"];
        metadata: Record<string, unknown>;
      }> = [
        {
          name: seed.asset.hostname,
          type: seed.asset.assetType,
          risk: "critical",
          metadata: {
            os: seed.asset.os,
            ipAddress: seed.asset.ipAddress,
            containsPHI: seed.asset.containsPHI,
          },
        },
        {
          name: seed.endpoint.hostname,
          type: "endpoint",
          risk: "high",
          metadata: {
            os: seed.endpoint.os,
            ipAddress: seed.endpoint.ipAddress,
            assignedUserId: seed.endpoint.assignedUserId,
            edrAgentId: seed.endpoint.edrAgentId,
          },
        },
      ];
      for (const a of assetSeeds) {
        try {
          const { data, error } = await getClient(supabase)
            .from("demo_assets")
            .insert({
              scenario_key: scenarioKey,
              client_name: seed.client.name,
              asset_name: a.name,
              asset_type: a.type,
              risk_level: a.risk,
              status: "healthy",
              metadata: a.metadata,
            })
            .select()
            .single();
          if (error) {
            logFailure("seedDemoScenario.insertAsset", error);
          } else if (data) {
            assets.push(data as DemoAssetRow);
          }
        } catch (error) {
          logFailure("seedDemoScenario.insertAsset", error);
        }
      }

      return { scenario, client, assets };
    },

    async resetDemoScenario(scenarioKey = DEMO_SCENARIO_ID) {
      const cleared: ResetDemoScenarioResult["cleared"] = {
        demo_events: "ok",
        demo_agent_reasoning: "ok",
        demo_actions: "ok",
        demo_reports: "ok",
        demo_metrics: "ok",
      };
      let firstError: string | undefined;

      const tables: Array<keyof ResetDemoScenarioResult["cleared"]> = [
        "demo_events",
        "demo_agent_reasoning",
        "demo_actions",
        "demo_reports",
        "demo_metrics",
      ];

      for (const table of tables) {
        try {
          const { error } = await getClient(supabase)
            .from(table)
            .delete()
            .eq("scenario_key", scenarioKey);
          if (error) {
            cleared[table] = "failed";
            firstError ??= error.message;
            logFailure(`resetDemoScenario.${table}`, error);
          }
        } catch (error) {
          cleared[table] = "failed";
          firstError ??= error instanceof Error ? error.message : "unknown error";
          logFailure(`resetDemoScenario.${table}`, error);
        }
      }

      const ok = Object.values(cleared).every((v) => v === "ok");
      return {
        scenarioKey,
        ok,
        cleared,
        ...(firstError ? { error: firstError } : {}),
      };
    },

    async getDemoTimeline(scenarioKey = DEMO_SCENARIO_ID) {
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_events")
          .select("*")
          .eq("scenario_key", scenarioKey)
          .order("event_order", { ascending: true });
        if (error) {
          logFailure("getDemoTimeline", error);
          return [];
        }
        return (data ?? []) as DemoEventRow[];
      } catch (error) {
        logFailure("getDemoTimeline", error);
        return [];
      }
    },

    async emitDemoEvent(input) {
      const scenarioKey = input.scenarioKey ?? DEMO_SCENARIO_ID;
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_events")
          .insert({
            scenario_key: scenarioKey,
            event_order: input.eventOrder,
            offset_seconds: input.offsetSeconds,
            event_type: input.eventType,
            severity: input.severity,
            title: input.title,
            description: input.description,
            agent_name: input.agentName ?? null,
            status: "emitted",
            payload: input.payload ?? {},
            emitted_at: nowIso(),
          })
          .select()
          .single();
        if (error) {
          logFailure("emitDemoEvent", error);
          return null;
        }
        return data as DemoEventRow;
      } catch (error) {
        logFailure("emitDemoEvent", error);
        return null;
      }
    },

    async updateDemoAction(actionId, input) {
      const patch: Record<string, unknown> = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.confirmed !== undefined) patch.confirmed = input.confirmed;
      if (input.resultSummary !== undefined) patch.result_summary = input.resultSummary;
      if (input.executedAt !== undefined) patch.executed_at = input.executedAt;
      if (Object.keys(patch).length === 0) {
        return null;
      }
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_actions")
          .update(patch)
          .eq("id", actionId)
          .select()
          .single();
        if (error) {
          logFailure("updateDemoAction", error);
          return null;
        }
        return data as DemoActionRow;
      } catch (error) {
        logFailure("updateDemoAction", error);
        return null;
      }
    },

    async getDemoMetrics(scenarioKey = DEMO_SCENARIO_ID) {
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_metrics")
          .select("*")
          .eq("scenario_key", scenarioKey)
          .order("sort_order", { ascending: true });
        if (error) {
          logFailure("getDemoMetrics", error);
          return [];
        }
        return (data ?? []) as DemoMetricRow[];
      } catch (error) {
        logFailure("getDemoMetrics", error);
        return [];
      }
    },

    async createDemoReport(input) {
      const scenarioKey = input.scenarioKey ?? DEMO_SCENARIO_ID;
      try {
        const { data, error } = await getClient(supabase)
          .from("demo_reports")
          .insert({
            scenario_key: scenarioKey,
            report_type: input.reportType,
            title: input.title,
            summary: input.summary,
            report_json: input.reportJson ?? {},
          })
          .select()
          .single();
        if (error) {
          logFailure("createDemoReport", error);
          return null;
        }
        return data as DemoReportRow;
      } catch (error) {
        logFailure("createDemoReport", error);
        return null;
      }
    },
  };

  return repo;
}

// ---------------------------------------------------------------------------
// Convenience standalone helpers — mirror the user-requested function names.
// Each one builds a default repository on demand. Tests should prefer the
// factory `createDemoRepository(mock)` so they don't touch the admin client.
// ---------------------------------------------------------------------------

export async function seedDemoScenario(
  input?: SeedDemoScenarioInput,
): Promise<ReturnType<DemoRepository["seedDemoScenario"]>> {
  return createDemoRepository().seedDemoScenario(input);
}

export async function resetDemoScenario(
  scenarioKey?: string,
): Promise<ResetDemoScenarioResult> {
  return createDemoRepository().resetDemoScenario(scenarioKey);
}

export async function getDemoTimeline(scenarioKey?: string): Promise<DemoEventRow[]> {
  return createDemoRepository().getDemoTimeline(scenarioKey);
}

export async function emitDemoEvent(
  input: EmitDemoEventInput,
): Promise<DemoEventRow | null> {
  return createDemoRepository().emitDemoEvent(input);
}

export async function updateDemoAction(
  actionId: string,
  input: UpdateDemoActionInput,
): Promise<DemoActionRow | null> {
  return createDemoRepository().updateDemoAction(actionId, input);
}

export async function getDemoMetrics(scenarioKey?: string): Promise<DemoMetricRow[]> {
  return createDemoRepository().getDemoMetrics(scenarioKey);
}

export async function createDemoReport(
  input: CreateDemoReportInput,
): Promise<DemoReportRow | null> {
  return createDemoRepository().createDemoReport(input);
}

/**
 * Convenience: seed metrics rows from a {@link DemoMetrics}-like flat record.
 * Not part of the user-listed API but used by `demoMetricsService.ts` so the
 * dashboard can render the same numbers from Supabase.
 */
export async function upsertDemoMetricsBulk(
  metrics: ReadonlyArray<{
    metricKey: string;
    metricLabel: string;
    metricValue: string;
    sortOrder: number;
  }>,
  scenarioKey: string = DEMO_SCENARIO_ID,
  supabase?: SupabaseClient,
): Promise<DemoMetricRow[]> {
  if (metrics.length === 0) return [];
  try {
    const rows = metrics.map((m) => ({
      scenario_key: scenarioKey,
      metric_key: m.metricKey,
      metric_label: m.metricLabel,
      metric_value: m.metricValue,
      sort_order: m.sortOrder,
    }));
    const { data, error } = await getClient(supabase)
      .from("demo_metrics")
      .upsert(rows, { onConflict: "scenario_key,metric_key" })
      .select();
    if (error) {
      logFailure("upsertDemoMetricsBulk", error);
      return [];
    }
    return (data ?? []) as DemoMetricRow[];
  } catch (error) {
    logFailure("upsertDemoMetricsBulk", error);
    return [];
  }
}

/** Re-export the canonical timeline so downstream code can populate Supabase from the same constant. */
export { DEMO_TIMELINE };

// ===========================================================================
// Investor demo CLI helpers
// ---------------------------------------------------------------------------
// These power `npm run demo:seed`, `npm run demo:reset`, and `npm run demo:run`.
// Logic lives here (not in the script files) so unit tests can drive the full
// flow against a stateful in-memory Supabase mock.
// ===========================================================================

export interface SeedInvestorDemoCounts {
  scenario: number;
  client: number;
  assets: number;
  events: number;
  reasoning: number;
  actions: number;
  report_templates: number;
  metrics: number;
}

export interface SeedInvestorDemoResult {
  ok: boolean;
  scenarioKey: string;
  counts: SeedInvestorDemoCounts;
  errors: string[];
}

export interface ResetInvestorDemoResult {
  ok: boolean;
  scenarioKey: string;
  /** Per-step success flags, in execution order. */
  reset: {
    scenario_status: boolean;
    asset_statuses: boolean;
    event_statuses: boolean;
    action_statuses: boolean;
    non_template_reports: boolean;
  };
  errors: string[];
}

export interface RunInvestorDemoLogger {
  info(message: string, ctx?: Record<string, unknown>): void;
}

export interface RunInvestorDemoClock {
  /** Current ms — virtual or wall-clock. */
  now(): number;
  /** Advance the (virtual) clock by `ms`; in real-time mode actually sleeps. */
  sleep(ms: number): Promise<void>;
}

export interface RunInvestorDemoOptions {
  /** Defaults to the canonical investor scenario key. */
  scenarioKey?: string;
  /** Speed multiplier (1 = real-time). Higher = faster for rehearsals. */
  speedMultiplier?: number;
  /** Logger override — defaults to `console`. */
  logger?: RunInvestorDemoLogger;
  /** Clock override — defaults to `setTimeout`-backed sleep. */
  clock?: RunInvestorDemoClock;
}

export interface RunInvestorDemoResult {
  ok: boolean;
  scenarioKey: string;
  emittedEventCount: number;
  /** Snapshot of demo_metrics rows at the end of the run. */
  finalMetrics: DemoMetricRow[];
  errors: string[];
}

const defaultLogger: RunInvestorDemoLogger = {
  info(message, ctx) {
    if (ctx) console.log(message, ctx);
    else console.log(message);
  },
};

const defaultClock: RunInvestorDemoClock = {
  now() {
    return Date.now();
  },
  sleep(ms) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

/** Normalises any thrown value (Error, supabase `{ message }` object, primitive) to a string. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/**
 * Seed every investor-demo table from {@link INVESTOR_DEMO_SCENARIO}.
 *
 * Idempotency strategy per table:
 *   - `demo_scenarios`           — UPSERT on `scenario_key`
 *   - `demo_clients`             — DELETE by scenario_key, then INSERT
 *   - `demo_assets`              — DELETE by scenario_key, then INSERT (status='healthy')
 *   - `demo_events`              — DELETE by scenario_key, then INSERT (status='pending')
 *   - `demo_agent_reasoning`     — DELETE by scenario_key, then INSERT
 *   - `demo_actions`             — DELETE by scenario_key, then INSERT (status='pending')
 *   - `demo_reports` (templates) — DELETE WHERE scenario_key AND title LIKE 'Seed: %', then INSERT templates only
 *   - `demo_metrics`             — UPSERT on `(scenario_key, metric_key)`
 *
 * Generated reports (those without the "Seed: " title prefix) are NEVER
 * touched by seed — they only get cleared by reset. This keeps a partially
 * completed run intact when seed is re-run.
 */
export async function seedInvestorDemoScenario(
  scenario: InvestorDemoScenario = INVESTOR_DEMO_SCENARIO,
  supabase?: SupabaseClient,
): Promise<SeedInvestorDemoResult> {
  const client = getClient(supabase);
  const scenarioKey = scenario.scenario_key;
  const errors: string[] = [];
  const counts: SeedInvestorDemoCounts = {
    scenario: 0,
    client: 0,
    assets: 0,
    events: 0,
    reasoning: 0,
    actions: 0,
    report_templates: 0,
    metrics: 0,
  };

  const recordError = (scope: string, err: unknown): void => {
    errors.push(`${scope}: ${describeError(err)}`);
    logFailure(`seedInvestorDemoScenario.${scope}`, err);
  };

  // 1. demo_scenarios — upsert
  try {
    const { data, error } = await client
      .from("demo_scenarios")
      .upsert(
        {
          scenario_key: scenarioKey,
          name: scenario.name,
          description: scenario.description,
          status: "ready",
        },
        { onConflict: "scenario_key" },
      )
      .select()
      .single();
    if (error) recordError("demo_scenarios", error);
    else if (data) counts.scenario = 1;
  } catch (err) {
    recordError("demo_scenarios", err);
  }

  // Helper for the delete-then-insert tables.
  const deleteByScenarioKey = async (table: string): Promise<void> => {
    try {
      const { error } = await client.from(table).delete().eq("scenario_key", scenarioKey);
      if (error) recordError(`${table}.delete`, error);
    } catch (err) {
      recordError(`${table}.delete`, err);
    }
  };

  // 2. demo_clients
  await deleteByScenarioKey("demo_clients");
  try {
    const { data, error } = await client
      .from("demo_clients")
      .insert({
        scenario_key: scenarioKey,
        client_name: scenario.client.client_name,
        industry: scenario.client.industry,
        employee_count: scenario.client.employee_count,
        msp_name: scenario.client.msp_name,
        compliance_frameworks: [...scenario.client.compliance_frameworks],
        metadata: scenario.client.metadata,
      })
      .select();
    if (error) recordError("demo_clients.insert", error);
    else counts.client = (data ?? []).length;
  } catch (err) {
    recordError("demo_clients.insert", err);
  }

  // 3. demo_assets — always seeded with status='healthy'
  await deleteByScenarioKey("demo_assets");
  try {
    const rows = scenario.assets.map((a) => ({
      scenario_key: scenarioKey,
      client_name: scenario.client.client_name,
      asset_name: a.asset_name,
      asset_type: a.asset_type,
      risk_level: a.risk_level,
      status: "healthy" as const,
      metadata: a.metadata,
    }));
    const { data, error } = await client.from("demo_assets").insert(rows).select();
    if (error) recordError("demo_assets.insert", error);
    else counts.assets = (data ?? []).length;
  } catch (err) {
    recordError("demo_assets.insert", err);
  }

  // 4. demo_events — always seeded with status='pending', emitted_at=null
  await deleteByScenarioKey("demo_events");
  try {
    const rows = scenario.timeline.map((e) => ({
      scenario_key: scenarioKey,
      event_order: e.event_order,
      offset_seconds: e.offset_seconds,
      event_type: e.event_type,
      severity: e.severity,
      title: e.title,
      description: e.description,
      agent_name: e.agent_name,
      status: "pending" as const,
      payload: e.payload,
      emitted_at: null,
    }));
    const { data, error } = await client.from("demo_events").insert(rows).select();
    if (error) recordError("demo_events.insert", error);
    else counts.events = (data ?? []).length;
  } catch (err) {
    recordError("demo_events.insert", err);
  }

  // 5. demo_agent_reasoning
  await deleteByScenarioKey("demo_agent_reasoning");
  try {
    const rows = scenario.reasoning.map((r) => ({
      scenario_key: scenarioKey,
      event_type: r.for_event_type,
      agent_name: r.agent_name,
      reasoning_summary: r.reasoning_summary,
      confidence: r.confidence,
      evidence: [],
    }));
    const { data, error } = await client
      .from("demo_agent_reasoning")
      .insert(rows)
      .select();
    if (error) recordError("demo_agent_reasoning.insert", error);
    else counts.reasoning = (data ?? []).length;
  } catch (err) {
    recordError("demo_agent_reasoning.insert", err);
  }

  // 6. demo_actions — always seeded as 'pending'
  await deleteByScenarioKey("demo_actions");
  try {
    const rows = scenario.actions.map((a) => ({
      scenario_key: scenarioKey,
      action_type: a.action_type,
      action_label: a.action_label,
      safety_level: a.safety_level,
      requires_confirmation: a.requires_confirmation,
      confirmed: false,
      status: "pending" as const,
      result_summary: null,
      executed_at: null,
    }));
    const { data, error } = await client.from("demo_actions").insert(rows).select();
    if (error) recordError("demo_actions.insert", error);
    else counts.actions = (data ?? []).length;
  } catch (err) {
    recordError("demo_actions.insert", err);
  }

  // 7. demo_reports — only delete templates (preserve generated reports)
  try {
    const { error } = await client
      .from("demo_reports")
      .delete()
      .eq("scenario_key", scenarioKey)
      .like("title", `${INVESTOR_DEMO_SEED_REPORT_PREFIX}%`);
    if (error) recordError("demo_reports.deleteTemplates", error);
  } catch (err) {
    recordError("demo_reports.deleteTemplates", err);
  }
  try {
    const rows = scenario.report_templates.map((t) => ({
      scenario_key: scenarioKey,
      report_type: t.report_type,
      title: t.title,
      summary: t.summary,
      report_json: t.report_json,
    }));
    const { data, error } = await client.from("demo_reports").insert(rows).select();
    if (error) recordError("demo_reports.insertTemplates", error);
    else counts.report_templates = (data ?? []).length;
  } catch (err) {
    recordError("demo_reports.insertTemplates", err);
  }

  // 8. demo_metrics — upsert on composite key
  try {
    const rows = scenario.metrics.map((m) => ({
      scenario_key: scenarioKey,
      metric_key: m.metric_key,
      metric_label: m.metric_label,
      metric_value: m.metric_value,
      sort_order: m.sort_order,
    }));
    const { data, error } = await client
      .from("demo_metrics")
      .upsert(rows, { onConflict: "scenario_key,metric_key" })
      .select();
    if (error) recordError("demo_metrics.upsert", error);
    else counts.metrics = (data ?? []).length;
  } catch (err) {
    recordError("demo_metrics.upsert", err);
  }

  return {
    ok: errors.length === 0,
    scenarioKey,
    counts,
    errors,
  };
}

/**
 * Reset every per-run mutation while preserving the seed snapshot:
 *   - `demo_scenarios.status`             → 'ready'
 *   - `demo_assets.status`                → 'healthy'
 *   - `demo_events.status`                → 'pending', `emitted_at` → null
 *   - `demo_actions.status`               → 'pending', `confirmed=false`,
 *                                            `executed_at=null`, `result_summary=null`
 *   - `demo_reports`                      → DELETE rows whose `title` does NOT
 *                                            start with `INVESTOR_DEMO_SEED_REPORT_PREFIX`
 *   - `demo_metrics`                      → untouched (scenario-static)
 *   - `demo_agent_reasoning`              → untouched (scenario-static)
 */
export async function resetInvestorDemoScenario(
  scenarioKey: string = INVESTOR_DEMO_SCENARIO.scenario_key,
  supabase?: SupabaseClient,
): Promise<ResetInvestorDemoResult> {
  const client = getClient(supabase);
  const errors: string[] = [];
  const reset = {
    scenario_status: false,
    asset_statuses: false,
    event_statuses: false,
    action_statuses: false,
    non_template_reports: false,
  };

  const recordError = (scope: string, err: unknown): void => {
    errors.push(`${scope}: ${describeError(err)}`);
    logFailure(`resetInvestorDemoScenario.${scope}`, err);
  };

  // 1. Restore scenario status to 'ready'
  try {
    const { error } = await client
      .from("demo_scenarios")
      .update({ status: "ready" })
      .eq("scenario_key", scenarioKey);
    if (error) recordError("demo_scenarios", error);
    else reset.scenario_status = true;
  } catch (err) {
    recordError("demo_scenarios", err);
  }

  // 2. Restore all assets to healthy
  try {
    const { error } = await client
      .from("demo_assets")
      .update({ status: "healthy" })
      .eq("scenario_key", scenarioKey);
    if (error) recordError("demo_assets", error);
    else reset.asset_statuses = true;
  } catch (err) {
    recordError("demo_assets", err);
  }

  // 3. Reset events to pending, clear emitted_at
  try {
    const { error } = await client
      .from("demo_events")
      .update({ status: "pending", emitted_at: null })
      .eq("scenario_key", scenarioKey);
    if (error) recordError("demo_events", error);
    else reset.event_statuses = true;
  } catch (err) {
    recordError("demo_events", err);
  }

  // 4. Reset actions to pending
  try {
    const { error } = await client
      .from("demo_actions")
      .update({
        status: "pending",
        confirmed: false,
        executed_at: null,
        result_summary: null,
      })
      .eq("scenario_key", scenarioKey);
    if (error) recordError("demo_actions", error);
    else reset.action_statuses = true;
  } catch (err) {
    recordError("demo_actions", err);
  }

  // 5. Delete generated reports (anything whose title does NOT start with the seed prefix)
  try {
    const { error } = await client
      .from("demo_reports")
      .delete()
      .eq("scenario_key", scenarioKey)
      .not("title", "like", `${INVESTOR_DEMO_SEED_REPORT_PREFIX}%`);
    if (error) recordError("demo_reports", error);
    else reset.non_template_reports = true;
  } catch (err) {
    recordError("demo_reports", err);
  }

  return {
    ok: errors.length === 0,
    scenarioKey,
    reset,
    errors,
  };
}

/**
 * Drive the timeline forward in real time:
 *   1. UPDATE demo_scenarios SET status='running'
 *   2. SELECT events ORDER BY event_order ASC
 *   3. For each event: sleep until offset_seconds * 1000 / speedMultiplier,
 *      then UPDATE demo_events SET status='emitted', emitted_at=now()
 *      WHERE (scenario_key, event_order). Log to the injected logger.
 *   4. UPDATE demo_scenarios SET status='completed'
 *   5. SELECT * FROM demo_metrics ORDER BY sort_order
 *
 * Real wall-clock waits use `setTimeout`; the test suite passes a fake clock
 * that resolves immediately so the run finishes in microseconds.
 */
export async function runInvestorDemoScenario(
  options: RunInvestorDemoOptions = {},
  supabase?: SupabaseClient,
): Promise<RunInvestorDemoResult> {
  const client = getClient(supabase);
  const scenarioKey = options.scenarioKey ?? INVESTOR_DEMO_SCENARIO.scenario_key;
  const speed = options.speedMultiplier ?? 1;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`[runInvestorDemoScenario] invalid speedMultiplier: ${speed}`);
  }
  const logger = options.logger ?? defaultLogger;
  const clock = options.clock ?? defaultClock;
  const errors: string[] = [];
  let emittedEventCount = 0;

  const recordError = (scope: string, err: unknown): void => {
    errors.push(`${scope}: ${describeError(err)}`);
    logFailure(`runInvestorDemoScenario.${scope}`, err);
  };

  // 1. Mark scenario running
  try {
    const { error } = await client
      .from("demo_scenarios")
      .update({ status: "running" })
      .eq("scenario_key", scenarioKey);
    if (error) recordError("demo_scenarios.running", error);
  } catch (err) {
    recordError("demo_scenarios.running", err);
  }

  // 2. Load events in canonical order
  let events: DemoEventRow[] = [];
  try {
    const { data, error } = await client
      .from("demo_events")
      .select("*")
      .eq("scenario_key", scenarioKey)
      .order("event_order", { ascending: true });
    if (error) recordError("demo_events.select", error);
    else events = (data ?? []) as DemoEventRow[];
  } catch (err) {
    recordError("demo_events.select", err);
  }

  // 3. Walk the timeline using the injected clock so virtual clocks (tests)
  //    and real-wall-clock runs share the same control flow.
  const startMs = clock.now();
  for (const event of events) {
    const targetMs = startMs + (event.offset_seconds * 1000) / speed;
    const waitMs = Math.max(0, targetMs - clock.now());
    await clock.sleep(waitMs);

    try {
      const { error } = await client
        .from("demo_events")
        .update({ status: "emitted", emitted_at: nowIso() })
        .eq("scenario_key", scenarioKey)
        .eq("event_order", event.event_order);
      if (error) {
        recordError(`demo_events.emit.${event.event_order}`, error);
      } else {
        emittedEventCount += 1;
        logger.info(
          `[demo:run] +${event.offset_seconds}s — ${event.event_type}: ${event.title}`,
          {
            event_order: event.event_order,
            severity: event.severity,
            agent: event.agent_name,
          },
        );
      }
    } catch (err) {
      recordError(`demo_events.emit.${event.event_order}`, err);
    }
  }

  // 4. Mark scenario completed
  try {
    const { error } = await client
      .from("demo_scenarios")
      .update({ status: "completed" })
      .eq("scenario_key", scenarioKey);
    if (error) recordError("demo_scenarios.completed", error);
  } catch (err) {
    recordError("demo_scenarios.completed", err);
  }

  // 5. Final metrics snapshot
  let finalMetrics: DemoMetricRow[] = [];
  try {
    const { data, error } = await client
      .from("demo_metrics")
      .select("*")
      .eq("scenario_key", scenarioKey)
      .order("sort_order", { ascending: true });
    if (error) recordError("demo_metrics.select", error);
    else finalMetrics = (data ?? []) as DemoMetricRow[];
  } catch (err) {
    recordError("demo_metrics.select", err);
  }

  return {
    ok: errors.length === 0 && emittedEventCount === events.length && events.length > 0,
    scenarioKey,
    emittedEventCount,
    finalMetrics,
    errors,
  };
}
