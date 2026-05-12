/**
 * Routes stamped {@link SimulatedEvent} payloads into sinks: console, Supabase audit ledger, or Inngest.
 * No secrets embedded — all credentials come from environment variables.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Inngest } from "inngest";
import type { SimulatedEvent } from "../types";
import type { ScenarioDefinition } from "../schema";
import {
  shouldSimulateDatabaseInsertFailure,
  shouldSimulateInngestSendFailure,
} from "./failureInjector";
import type { DemoSimulationContext } from "../fixtures/demoMode";

export type SimulationMode = "local" | "supabase" | "inngest";

const MONITORING_EVENT = "securewatch/monitoring.alert.received" as const;

export function resolveSimulationMode(raw?: string): SimulationMode {
  const v = (raw ?? process.env.SIMULATION_MODE ?? "local").trim().toLowerCase();
  if (v === "local" || v === "supabase" || v === "inngest") return v;
  throw new Error(
    `Invalid SIMULATION_MODE "${raw}". Expected local, supabase, or inngest.`,
  );
}

export function getSupabaseProjectUrlFromEnv(): string {
  const fromEnv =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!fromEnv) {
    throw new Error(
      "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) for Supabase-backed simulation emits.",
    );
  }
  return fromEnv;
}

export function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for Supabase simulation adapter.");
  return key;
}

export function requireSimulationTenantId(): string {
  const id = process.env.SIMULATION_TENANT_ID?.trim();
  if (!id) {
    throw new Error(
      "Set SIMULATION_TENANT_ID (tenant UUID) when using supabase or inngest simulation modes.",
    );
  }
  return id;
}

function createSimulationSupabaseAdmin(): SupabaseClient {
  return createClient(getSupabaseProjectUrlFromEnv(), requireServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createSimulationInngest(): Inngest {
  const eventKey = process.env.INNGEST_EVENT_KEY?.trim();
  if (!eventKey) throw new Error("Missing INNGEST_EVENT_KEY for Inngest simulation adapter.");

  return new Inngest({
    id: "securewatch360-simulation-runner",
    name: "SecureWatch360 Simulation Runner",
    eventKey,
  });
}

function mapSeverityForMonitoring(
  scenario: ScenarioDefinition,
  payload: Record<string, unknown>,
): "info" | "low" | "medium" | "high" | "critical" {
  const payloadSevRaw = typeof payload.severity === "string" ? payload.severity.trim() : "";
  const payloadNorm = payloadSevRaw.replace(/^informational$/i, "info").toLowerCase();
  const allowed = ["info", "low", "medium", "high", "critical"] as const;
  const fromPayload = allowed.find((s) => s === payloadNorm);
  if (fromPayload) return fromPayload;

  const s = scenario.severity === "informational" ? "info" : scenario.severity;
  if (allowed.includes(s as (typeof allowed)[number])) return s as (typeof allowed)[number];
  return "medium";
}

/**
 * Builds the production monitoring alert envelope used by SecureWatch360 Inngest functions.
 * Keeps payloads synthetic — passes through simulator metadata only.
 */
export function simulatedEventToMonitoringPayload(
  event: SimulatedEvent,
  scenario: ScenarioDefinition,
  tenantId: string,
  demoContext?: DemoSimulationContext,
): {
  tenantId: string;
  source: string;
  alertType: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description?: string;
  targetValue?: string;
  createFinding?: boolean;
  metadata: Record<string, unknown>;
} {
  const payload = event.payload;
  const source =
    (typeof payload.source === "string" && payload.source.trim()) ||
    (typeof payload.simulator_source === "string" && payload.simulator_source.trim()) ||
    "simulator";

  const alertType =
    (typeof payload.alert_type === "string" && payload.alert_type.trim()) ||
    (typeof payload.alertType === "string" && payload.alertType.trim()) ||
    (typeof payload.category === "string" && payload.category.trim()) ||
    `synthetic_${event.kind.replace(/\./g, "_")}`;

  const title =
    (typeof payload.title === "string" && payload.title.trim()) ||
    (typeof payload.subject === "string" && payload.subject.trim()) ||
    scenario.name;

  const description =
    (typeof payload.description === "string" && payload.description.trim()) ||
    scenario.description;

  const targetValue =
    typeof payload.target_value === "string"
      ? payload.target_value
      : typeof payload.targetValue === "string"
        ? payload.targetValue
        : typeof payload.device_hostname === "string"
          ? payload.device_hostname
          : undefined;

  const createFinding =
    event.kind === "finding.synthetic" ? true : (payload.createFinding as boolean | undefined);

  const severity = mapSeverityForMonitoring(scenario, payload);

  return {
    tenantId,
    source,
    alertType,
    severity,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(targetValue !== undefined ? { targetValue } : {}),
    ...(createFinding !== undefined ? { createFinding } : {}),
    metadata: {
      simulated: true,
      simulationRunner: true,
      simulationRunId: event.runId,
      simulationScenarioId: scenario.id,
      simulationEventId: event.id,
      synthetic_kind: event.kind,
      ...(event.metadata ?? {}),
      ...(demoContext
        ? {
            sw360_simulation_demo: true,
            demo_fixture_client: demoContext.client.display_name,
            demo_fixture_tenant_id: demoContext.client.id,
            remediation_live_execution_blocked: true,
          }
        : {}),
    },
  };
}

async function auditSimulationEmit(params: {
  supabase: SupabaseClient;
  tenantId: string;
  envelope: Record<string, unknown>;
}): Promise<string | undefined> {
  const auditPayload = params.envelope;
  const { data, error } = await params.supabase
    .from("audit_logs")
    .insert({
      tenant_id: params.tenantId,
      action: "simulation.synthetic_event_emitted",
      payload: auditPayload as never,
      entity_type: "simulation_run",
      entity_id:
        typeof auditPayload.simulation_run_id === "string"
          ? auditPayload.simulation_run_id
          : "unknown",
      summary: "Synthetic simulation event recorded (SecureWatch360 lab runner).",
      user_id: null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`audit_logs insert failed: ${error.message}`);
  }
  return data?.id ?? undefined;
}

async function emitConsoleLine(line: Record<string, unknown>): Promise<void> {
  console.log(JSON.stringify({ ts: new Date().toISOString(), simulationSink: "console", ...line }));
}

export type EmitCorrelation = {
  mode: SimulationMode;
  ingest?: unknown;
  auditLogId?: string;
  inject_error?: {
    type: string;
    message: string;
    skipped_audit?: boolean;
    skipped_inngest?: boolean;
  };
};

export type EmitSimulatedEventOptions = {
  /** Zero-based index among emissions in this run (for `database_failure` / `inngest_failure`). */
  sequenceIndex?: number;
  /** When true, envelopes and console previews are stamped as investor-safe demo-only data. */
  simulationDemo?: boolean;
  /** Populated when `simulationDemo`; used for tenant-id substitution in local sink previews. */
  demoContext?: DemoSimulationContext | null;
};

/** Emit one simulated event according to SIMULATION_MODE. */
export async function emitSimulatedEvent(
  scenario: ScenarioDefinition,
  event: SimulatedEvent,
  mode?: SimulationMode,
  options?: EmitSimulatedEventOptions,
): Promise<EmitCorrelation> {
  const m = mode ?? resolveSimulationMode();
  const sequenceIndex = options?.sequenceIndex ?? 0;
  const demo = options?.simulationDemo === true;
  const demoCtx = options?.demoContext ?? undefined;

  await emitConsoleLine({
    phase: "emit_start",
    mode: m,
    scenarioId: scenario.id,
    runId: event.runId,
    eventId: event.id,
    kind: event.kind,
    ...(demo ? { simulation_demo_mode: true, demo_fixture_client: demoCtx?.client.display_name } : {}),
  });

  if (m === "local") {
    const pseudoTenant =
      demoCtx?.client.id ??
      process.env.SIMULATION_TENANT_ID?.trim() ??
      "11111111-1111-1111-1111-111111111111";
    if (shouldSimulateDatabaseInsertFailure(scenario, m, sequenceIndex)) {
      await emitConsoleLine({
        phase: "emit_local_metadata",
        note:
          "failure_injection=database_failure skipped (local mode has no Supabase insert); use supabase/inngest mode to exercise audit insert faults.",
      });
    }
    await emitConsoleLine({
      phase: "emit_complete",
      mode: m,
      payloadPreview: prunePayloadForLog(
        simulatedEventToMonitoringPayload(event, scenario, pseudoTenant, demoCtx),
      ),
      ...(demo ? { simulation_demo_mode: true, live_remediation_suppressed: true } : {}),
    });
    return { mode: m };
  }

  const tenantId = requireSimulationTenantId();
  const payloadEnvelope = buildAuditEnvelope(scenario, event, m, demoCtx);
  let auditLogId: string | undefined;

  if (shouldSimulateDatabaseInsertFailure(scenario, m, sequenceIndex)) {
    await emitConsoleLine({
      phase: "audit_write_injected_skip",
      sequenceIndex,
      failure_injection: "database_failure",
      runId: event.runId,
      eventId: event.id,
    });
    return {
      mode: m,
      auditLogId: undefined,
      inject_error: {
        type: "database_failure",
        message: "Synthetic Supabase audit_logs insert failure (simulator failure injection).",
        skipped_audit: true,
      },
    };
  }

  const supabase = createSimulationSupabaseAdmin();
  auditLogId = await auditSimulationEmit({
    supabase,
    tenantId,
    envelope: payloadEnvelope,
  });

  await emitConsoleLine({
    phase: "audit_written",
    auditLogId,
  });

  let ingest: unknown;

  if (m === "inngest") {
    if (shouldSimulateInngestSendFailure(scenario, m, sequenceIndex)) {
      ingest = {
        failure_injection: true,
        injected_error: "inngest_send_failed",
        sequenceIndex,
      };
      await emitConsoleLine({
        phase: "inngest_send_injected_failure",
        sequenceIndex,
        failure_injection: "inngest_failure",
        ingestSummary: ingest,
      });
    } else {
      const monitoring = simulatedEventToMonitoringPayload(event, scenario, tenantId, demoCtx);
      const ng = createSimulationInngest();
      ingest = await ng.send({
        name: MONITORING_EVENT,
        data: monitoring,
      });
      await emitConsoleLine({
        phase: "inngest_send_complete",
        ingestSummary: sanitizeIngestAck(ingest),
      });
    }
  }

  const inject_error = shouldSimulateInngestSendFailure(scenario, m, sequenceIndex)
    ? {
        type: "inngest_failure",
        message: "Synthetic Inngest send failure (simulator failure injection).",
        skipped_inngest: true,
      }
    : undefined;

  return {
    mode: m,
    ingest,
    auditLogId,
    ...(inject_error ? { inject_error } : {}),
  };
}

function buildAuditEnvelope(
  scenario: ScenarioDefinition,
  event: SimulatedEvent,
  mode: SimulationMode,
  demoContext?: DemoSimulationContext,
): Record<string, unknown> {
  const tenantSegment = process.env.SIMULATION_TENANT_ID?.trim() ?? null;
  const demoTenant = demoContext?.client.id;
  return {
    simulation_run_id: event.runId,
    simulation_event_id: event.id,
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    severity: scenario.severity,
    attack_category: scenario.attack_category,
    simulated_at: event.simulatedAt,
    synthetic_kind: event.kind,
    simulation_mode: mode,
    ...(demoContext
      ? {
          sw360_simulation_demo: true,
          demo_fixture_client: demoContext.client.display_name,
          demo_fixture_tenant_id: demoContext.client.id,
          remediation_live_execution_blocked: true,
        }
      : {}),
    ...(tenantSegment ? { simulation_tenant_id: tenantSegment } : {}),
    ...(demoTenant && !tenantSegment ? { simulation_tenant_id: demoTenant } : {}),
    event_payload: event.payload,
    monitoring_preview: simulatedEventToMonitoringPayload(
      event,
      scenario,
      tenantSegment ?? demoTenant ?? "00000000-0000-0000-0000-000000000000",
      demoContext,
    ),
  };
}

function prunePayloadForLog(monitoring: Record<string, unknown>): Record<string, unknown> {
  return {
    tenantId: monitoring.tenantId,
    source: monitoring.source,
    alertType: monitoring.alertType,
    severity: monitoring.severity,
    title: monitoring.title,
  };
}

function sanitizeIngestAck(ingest: unknown): unknown {
  if (typeof ingest !== "object" || ingest === null) return ingest;
  return { ...(ingest as Record<string, unknown>) };
}

export async function emitSimulatedEvents(
  scenario: ScenarioDefinition,
  events: SimulatedEvent[],
  mode?: SimulationMode,
  options?: Omit<EmitSimulatedEventOptions, "sequenceIndex">,
): Promise<EmitCorrelation[]> {
  const m = mode ?? resolveSimulationMode();
  const staggerMs = Number.parseInt(process.env.SIMULATION_EMIT_STAGGER_MS ?? "250", 10);
  const out: EmitCorrelation[] = [];
  for (let i = 0; i < events.length; i += 1) {
    if (i > 0 && staggerMs > 0) await sleep(staggerMs);
    out.push(await emitSimulatedEvent(scenario, events[i], m, { ...options, sequenceIndex: i }));
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
