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
import { getDemoSeed, type DemoSeedSnapshot } from "./demoSeedData";

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
  status: "healthy" | "at_risk" | "compromised" | "isolated" | "remediated";
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
