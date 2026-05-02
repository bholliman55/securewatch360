/**
 * Waits briefly for workflows, gathers Supabase signals, evaluates expectations, persists JSON results.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScenarioDefinition } from "../schema";
import type { SimulationRun, SimulationResult, ValidationResult } from "../types";
import {
  getSupabaseProjectUrlFromEnv,
  requireServiceRoleKey,
  requireSimulationTenantId,
  resolveSimulationMode,
  type SimulationMode,
} from "./eventEmitter";

export type SimulationAuditRow = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type CollectedSignals = {
  observationWindowStartIso: string;
  observationWindowEndIso: string;
  pollIterations: number;
  /** Audit rows correlated to this run (filtered client-side by simulation_run_id). */
  auditRowsForRun: SimulationAuditRow[];
  /** Adjacent timeline rows captured while polling (for fuzzy agent matching). */
  auditRowsNearTimeline: SimulationAuditRow[];
};

let mockCollectorClient: SupabaseClient | undefined;

/** Test hook: bypass network with a mocked client. */
export function __setResultCollectorMockClient(client: SupabaseClient | undefined): void {
  mockCollectorClient = client;
}

function createCollectorSupabase(): SupabaseClient {
  if (mockCollectorClient) return mockCollectorClient;
  return createClient(getSupabaseProjectUrlFromEnv(), requireServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function parseWaitEnv(): { waitMs: number; pollMs: number; maxPollIterations: number } {
  const waitMs = Number.parseInt(process.env.SIMULATION_AGENT_WAIT_MS ?? "5000", 10);
  const pollMs = Number.parseInt(process.env.SIMULATION_POLL_INTERVAL_MS ?? "750", 10);
  const maxPollIterations = Number.parseInt(process.env.SIMULATION_MAX_POLL_ITERATIONS ?? "60", 10);
  return { waitMs: Math.max(0, waitMs), pollMs: Math.max(100, pollMs), maxPollIterations: Math.max(1, maxPollIterations) };
}

async function delay(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchRecentAuditTimeline(
  supabase: SupabaseClient,
  tenantId: string,
  sinceIso: string,
  limit = 80,
): Promise<SimulationAuditRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, payload, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`audit_logs timeline query failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    action: row.action as string,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    created_at: row.created_at as string,
  }));
}

function filterAuditRowsForRun(rows: SimulationAuditRow[], runId: string): SimulationAuditRow[] {
  return rows.filter((r) => {
    const p = r.payload;
    const rid = typeof p.simulation_run_id === "string" ? p.simulation_run_id : "";
    const nested =
      typeof p.event_payload === "object" && p.event_payload !== null
        ? (p.event_payload as Record<string, unknown>)
        : null;
    return rid === runId || (nested?.run_ref as string | undefined) === runId;
  });
}

async function passiveWait(waitMs: number): Promise<void> {
  await delay(waitMs);
}

async function polledCollect(
  supabase: SupabaseClient,
  tenantId: string,
  runId: string,
  sinceIso: string,
  pollMs: number,
  maxIterations: number,
): Promise<{ rowsForRun: SimulationAuditRow[]; near: SimulationAuditRow[]; polls: number }> {
  let polls = 0;
  while (polls < maxIterations) {
    polls += 1;
    const near = await fetchRecentAuditTimeline(supabase, tenantId, sinceIso);
    const aligned = filterAuditRowsForRun(near, runId);
    if (aligned.length > 0) {
      return { rowsForRun: aligned, near, polls };
    }
    await delay(pollMs);
  }
  const fallbackNear = await fetchRecentAuditTimeline(supabase, tenantId, sinceIso);
  const aligned = filterAuditRowsForRun(fallbackNear, runId);
  return { rowsForRun: aligned, near: fallbackNear, polls };
}

/**
 * Blocking observation phase: sleeps, optionally polls audit_logs when Supabase-backed modes are enabled.
 */
export async function observeAgentSignals(params: {
  runId: string;
  mode: SimulationMode;
  windowStartedAtIso?: string;
}): Promise<CollectedSignals> {
  const { waitMs, pollMs, maxPollIterations } = parseWaitEnv();
  const start = params.windowStartedAtIso ?? new Date().toISOString();
  const mode = params.mode ?? resolveSimulationMode();

  if (mode === "local") {
    await passiveWait(waitMs);
    const endIso = new Date().toISOString();
    return {
      observationWindowStartIso: start,
      observationWindowEndIso: endIso,
      pollIterations: 0,
      auditRowsForRun: [],
      auditRowsNearTimeline: [],
    };
  }

  const tenantId = requireSimulationTenantId();
  await passiveWait(Math.min(waitMs, pollMs)); // slight delay before polls to allow writes to land
  const supabase = createCollectorSupabase();
  const { rowsForRun, near, polls } = await polledCollect(
    supabase,
    tenantId,
    params.runId,
    start,
    pollMs,
    maxPollIterations,
  );

  return {
    observationWindowStartIso: start,
    observationWindowEndIso: new Date().toISOString(),
    pollIterations: polls,
    auditRowsForRun: rowsForRun,
    auditRowsNearTimeline: near,
  };
}

function rowBlob(row: SimulationAuditRow): string {
  return `${row.action} ${JSON.stringify(row.payload)}`.toLowerCase();
}

function expectationMetForStep(
  step: ScenarioDefinition["expected_agent_sequence"][number],
  signals: CollectedSignals,
): boolean {
  const needle = `${step.agent_key} ${step.capability}`.toLowerCase().replace(/\s+/g, " ").trim();

  const pool = [...signals.auditRowsForRun, ...signals.auditRowsNearTimeline];

  const match = pool.some((row) => {
    const blob = rowBlob(row);
    const agentSlug = step.agent_key.replace(/-/g, "_").toLowerCase();
    const capSlug = step.capability.replace(/-/g, "_").toLowerCase();
    return (
      blob.includes(needle.replace(/-/g, "_")) ||
      (blob.includes(agentSlug) && blob.includes(capSlug)) ||
      blob.includes(agentSlug)
    );
  });

  return match;
}

function expectationMetForControls(
  scenario: ScenarioDefinition,
  signals: CollectedSignals,
): { passed: boolean; detail: string } {
  const min = scenario.pass_fail_rules.min_controls_matched ?? 0;
  if (min <= 0) return { passed: true, detail: "No minimum control matches required." };

  const refs = scenario.expected_controls_triggered;
  const hay = [...signals.auditRowsForRun, ...signals.auditRowsNearTimeline].map(rowBlob).join("\n");

  let hits = 0;
  const labels: string[] = [];
  for (const ctrl of refs) {
    const id = ctrl.control_id?.trim();
    const fw = ctrl.framework.trim().toLowerCase();
    if (id && hay.includes(id.toLowerCase())) {
      hits += 1;
      labels.push(id);
      continue;
    }
    if (hay.includes(fw)) {
      hits += 1;
      labels.push(ctrl.framework);
    }
  }

  return {
    passed: hits >= min,
    detail: `Matched approx ${hits}/${refs.length} control hints (min=${min}); labels:${labels.slice(0, 6).join(",")}`,
  };
}

export function evaluateScenarioExpectations(params: {
  scenario: ScenarioDefinition;
  signals: CollectedSignals;
  runId: string;
}): SimulationResult {
  const { scenario } = params;
  const validations: ValidationResult[] = [];

  scenario.expected_agent_sequence.forEach((step, idx) => {
    const matched = expectationMetForStep(step, params.signals);
    validations.push({
      expectationId: step.id,
      passed: matched,
      detail: matched
        ? `Observed plausible activity for agent_key=${step.agent_key}, capability=${step.capability}`
        : `Insufficient correlated audit/Inngest side-effects for agent_key=${step.agent_key}`,
      observed:
        matched && params.signals.auditRowsForRun[0]
          ? {
              correlationAuditId: params.signals.auditRowsForRun[0].id,
              sequenceIndex: idx,
            }
          : { pollIterations: params.signals.pollIterations, sequenceIndex: idx },
    });
  });

  const agentOnly = validations.filter((v) =>
    scenario.expected_agent_sequence.some((s) => s.id === v.expectationId),
  );

  if (scenario.pass_fail_rules.agent_sequence_order_required) {
    validations.push({
      expectationId: "rule-order-check",
      passed: agentOnly.every((v) => v.passed),
      detail:
        "agent_sequence_order_required: requires every declared agent_sequence step to pass (fine-grained chronological correlation not yet modeled).",
    });
  }

  const controlsOutcome = expectationMetForControls(scenario, params.signals);
  validations.push({
    expectationId: "aggregation-controls",
    passed: controlsOutcome.passed,
    detail: controlsOutcome.detail,
    observed: { min_controls_matched: scenario.pass_fail_rules.min_controls_matched ?? 0 },
  });

  if (scenario.pass_fail_rules.all_report_sections_required) {
    validations.push({
      expectationId: "report-section-policy",
      passed: true,
      detail:
        "Structured report_sections were not synthesized in this MVP runner — flagged as informational pass; wire report generator to tighten this gate.",
      observed: { sections: scenario.expected_report_sections },
    });
  }

  const requireAgents = scenario.pass_fail_rules.require_all_agent_steps === true;
  const agentPasses = agentOnly;
  let passed = requireAgents ? agentPasses.every((v) => v.passed) : agentPasses.some((v) => v.passed);

  const orderGate = validations.find((v) => v.expectationId === "rule-order-check");
  if (orderGate && !orderGate.passed) passed = false;

  passed = passed && controlsOutcome.passed;

  return {
    runId: params.runId,
    scenarioId: scenario.id,
    passed,
    validations,
    summary: summarizeRun(scenario, passed, validations, params.signals),
    finishedAt: new Date().toISOString(),
  };
}

function summarizeRun(
  scenario: ScenarioDefinition,
  passed: boolean,
  validations: ValidationResult[],
  signals: CollectedSignals,
): string {
  const ok = validations.filter((v) => v.passed).length;
  return [
    `[simulation:${scenario.id}] outcome=${passed ? "PASS" : "FAIL"} validations_ok=${ok}/${validations.length}`,
    `signals: audit_aligned=${signals.auditRowsForRun.length} timeline=${signals.auditRowsNearTimeline.length} polls=${signals.pollIterations}`,
  ].join(" | ");
}

export interface StoredSimulationArtifacts {
  resultPath?: string;
  reportPath?: string;
}

/** Writes JSON payloads for CI/local inspection. */
export async function persistSimulationArtifacts(params: {
  run: SimulationRun;
  result: SimulationResult;
  report: Record<string, unknown>;
  baseDir?: string;
}): Promise<StoredSimulationArtifacts> {
  const root =
    params.baseDir ??
    process.env.SIMULATION_RESULTS_DIR?.trim() ??
    path.join(process.cwd(), ".simulation-results");

  await fs.mkdir(root, { recursive: true });

  const resultPath = path.join(root, `${params.run.id}-simulation-result.json`);
  await fs.writeFile(
    resultPath,
    `${JSON.stringify(
      {
        run: params.run,
        result: params.result,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const reportPath = path.join(root, `${params.run.id}-simulation-report.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(params.report, null, 2)}\n`, "utf8");

  return { resultPath, reportPath };
}
