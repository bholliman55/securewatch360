/**
 * Forensic timeline reconstruction for SecureWatch360 simulation runs.
 *
 * Architectural rule (non-negotiable):
 * - The **simulator** only generates **synthetic** telemetry and validates whether the
 *   **real** SecureWatch360 application (workflows, agents, audit, Inngest, etc.) produced
 *   expected correlated side effects.
 * - This module **does not** detect, triage, remediate, alert, ticket, or comply — it only
 *   **replays and correlates** persisted artifacts (run JSON, optional scenario, emissions).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { EmitCorrelation } from "../engines/eventEmitter";
import type { SimulationAuditRow } from "../engineSignals.types";
import type { ScenarioDefinition } from "../schema";
import type { SimulationResult, SimulationRun, SimulatedEvent, ValidationResult } from "../types";

export type ForensicSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ForensicTimelineLane =
  | "synthetic_emit"
  | "orchestration_correlation"
  | "observed_audit_echo"
  | "validation_outcome";

/** One row in the chronological forensic ledger (synthetic + correlation metadata only). */
export interface ForensicTimelineEvent {
  timestamp: string;
  trace_id: string;
  correlation_id: string;
  parent_event_id: string | null;
  source_agent: string;
  target_agent: string;
  simulation_run_id: string;
  severity: ForensicSeverity;
  event_hash: string;
  simulation_event_id: string;
  synthetic_kind: string;
  scenario_id: string;
  lane: ForensicTimelineLane;
  payload_redacted_summary: string;
}

export type EventTransitionKind =
  | "synthetic_emit"
  | "orchestration_handoff"
  | "audit_recorded"
  | "validation_gate";

/** Persisted transition edge (replay / audit / validation only — not a workflow execution). */
export interface EventTransitionRecord {
  transition_id: string;
  simulation_run_id: string;
  from_event_id: string | null;
  to_event_id: string;
  transition_kind: EventTransitionKind;
  recorded_at: string;
  metadata: Record<string, unknown>;
}

export interface ForensicAnomalies {
  duplicate_event_hashes: Array<{ event_hash: string; simulation_event_ids: string[] }>;
  orphaned_parent_references: string[];
  missing_workflow_transitions: Array<{ expectation_id: string; detail: string }>;
}

export interface ForensicTimelineDocument {
  schema_version: 1;
  generated_at: string;
  simulation_run_id: string;
  scenario_id: string;
  architecture_note: string;
  events: ForensicTimelineEvent[];
  event_transitions: EventTransitionRecord[];
  anomalies: ForensicAnomalies;
  incident_reconstruction_markdown: string;
}

export interface ReconstructForensicTimelineInput {
  run: SimulationRun;
  result: SimulationResult;
  scenario?: ScenarioDefinition | null;
  emissions?: EmitCorrelation[] | null;
  structuredReport?: Record<string, unknown> | null;
  auditRows?: SimulationAuditRow[] | null;
}

const ARCH_NOTE =
  "Simulator emits synthetic events only; SecureWatch360 application workflows perform all real detection, triage, remediation, alerting, ticketing, reporting, and compliance actions. This document reconstructs persisted lab artifacts — it does not execute or alter production behavior.";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",")}}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function mapScenarioSeverity(raw: string | undefined): ForensicSeverity {
  const s = (raw ?? "medium").toLowerCase();
  if (s === "informational") return "info";
  if (s === "info" || s === "low" || s === "medium" || s === "high" || s === "critical") return s;
  return "medium";
}

function eventSeverity(event: SimulatedEvent, scenario?: ScenarioDefinition | null): ForensicSeverity {
  const p = event.payload;
  if (typeof p.severity === "string" && p.severity.trim().length > 0) {
    return mapScenarioSeverity(p.severity.replace(/^informational$/i, "info"));
  }
  return mapScenarioSeverity(scenario?.severity);
}

function redactedSummary(event: SimulatedEvent): string {
  const p = event.payload;
  const title =
    typeof p.title === "string"
      ? p.title.slice(0, 200)
      : typeof p.subject === "string"
        ? p.subject.slice(0, 200)
        : event.kind;
  return `${event.kind}: ${title}`;
}

function traceIdForRun(runId: string): string {
  return `trace:${runId}`;
}

function correlationIdFor(runId: string, index: number, event: SimulatedEvent): string {
  const fromPayload =
    (typeof event.payload.correlation_id === "string" && event.payload.correlation_id.trim()) ||
    (typeof event.payload.correlationId === "string" && event.payload.correlationId.trim());
  if (fromPayload) return fromPayload;
  return `corr:${runId}:${index}`;
}

function parentEventId(events: SimulatedEvent[], index: number): string | null {
  if (index <= 0) return null;
  const cur = events[index];
  const explicit =
    (typeof cur.payload.parent_event_id === "string" && cur.payload.parent_event_id.trim()) ||
    (typeof cur.payload.parentEventId === "string" && cur.payload.parentEventId.trim());
  if (explicit) return explicit;
  return events[index - 1]?.id ?? null;
}

function hashSimulatedEvent(event: SimulatedEvent, scenarioId: string): string {
  const body = stableStringify({
    scenario_id: scenarioId,
    simulation_event_id: event.id,
    run_id: event.runId,
    kind: event.kind,
    simulated_at: event.simulatedAt,
    payload: event.payload,
  });
  return sha256Hex(body);
}

function sortEvents(events: SimulatedEvent[]): SimulatedEvent[] {
  return [...events].sort((a, b) => {
    const ta = Date.parse(a.simulatedAt);
    const tb = Date.parse(b.simulatedAt);
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

function extractEmissionsFromStructuredReport(
  structuredReport: Record<string, unknown> | null | undefined,
): EmitCorrelation[] | undefined {
  if (!structuredReport) return undefined;
  const telemetry = structuredReport.telemetry as Record<string, unknown> | undefined;
  if (!telemetry) return undefined;
  const raw = telemetry.emissions;
  if (!Array.isArray(raw)) return undefined;
  return raw as EmitCorrelation[];
}

function targetAgentForSyntheticKind(kind: string): string {
  if (kind.includes("finding")) return "securewatch360_scan_ingestion";
  if (kind.includes("monitoring")) return "securewatch360_inngest_monitoring";
  if (kind.includes("remediation")) return "securewatch360_remediation_router";
  if (kind.includes("external")) return "securewatch360_external_intel";
  return "securewatch360_orchestration";
}

function collectAnomalies(
  events: ForensicTimelineEvent[],
  validations: ValidationResult[],
  scenario: ScenarioDefinition | null | undefined,
): ForensicAnomalies {
  const byHash = new Map<string, string[]>();
  for (const e of events) {
    const list = byHash.get(e.event_hash) ?? [];
    list.push(e.simulation_event_id);
    byHash.set(e.event_hash, list);
  }
  const duplicate_event_hashes = [...byHash.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([event_hash, simulation_event_ids]) => ({ event_hash, simulation_event_ids }));

  const idSet = new Set(events.map((e) => e.simulation_event_id));
  const orphaned_parent_references: string[] = [];
  for (const e of events) {
    if (e.parent_event_id && !idSet.has(e.parent_event_id)) {
      orphaned_parent_references.push(`${e.simulation_event_id} -> ${e.parent_event_id}`);
    }
  }

  const missing_workflow_transitions: ForensicAnomalies["missing_workflow_transitions"] = [];
  const stepIds = new Set(scenario?.expected_agent_sequence.map((s) => s.id) ?? []);
  for (const v of validations) {
    if (!stepIds.has(v.expectationId)) continue;
    if (!v.passed) {
      missing_workflow_transitions.push({
        expectation_id: v.expectationId,
        detail: v.detail,
      });
    }
  }

  if (scenario?.pass_fail_rules.agent_sequence_order_required) {
    const orderRule = validations.find((v) => v.expectationId === "rule-order-check");
    if (orderRule && !orderRule.passed) {
      missing_workflow_transitions.push({
        expectation_id: "rule-order-check",
        detail: orderRule.detail,
      });
    }
  }

  return { duplicate_event_hashes, orphaned_parent_references, missing_workflow_transitions };
}

function buildTransitions(
  run: SimulationRun,
  sorted: SimulatedEvent[],
  emissions: EmitCorrelation[] | undefined,
  validations: ValidationResult[],
): EventTransitionRecord[] {
  const out: EventTransitionRecord[] = [];
  const runId = run.id;

  sorted.forEach((ev, idx) => {
    out.push({
      transition_id: `tx:${runId}:emit:${idx}`,
      simulation_run_id: runId,
      from_event_id: idx > 0 ? sorted[idx - 1].id : null,
      to_event_id: ev.id,
      transition_kind: "synthetic_emit",
      recorded_at: ev.simulatedAt,
      metadata: { sequence_index: idx, synthetic_kind: ev.kind },
    });

    const emission = emissions?.[idx];
    if (emission?.auditLogId) {
      out.push({
        transition_id: `tx:${runId}:audit:${idx}`,
        simulation_run_id: runId,
        from_event_id: ev.id,
        to_event_id: `audit:${emission.auditLogId}`,
        transition_kind: "audit_recorded",
        recorded_at: ev.simulatedAt,
        metadata: { audit_log_id: emission.auditLogId, mode: emission.mode },
      });
    }
    if (emission?.ingest !== undefined) {
      out.push({
        transition_id: `tx:${runId}:ingest:${idx}`,
        simulation_run_id: runId,
        from_event_id: ev.id,
        to_event_id: `orchestration:${idx}`,
        transition_kind: "orchestration_handoff",
        recorded_at: ev.simulatedAt,
        metadata: { mode: emission.mode, ingest_summary: typeof emission.ingest === "object" },
      });
    }
  });

  validations.forEach((v, i) => {
    out.push({
      transition_id: `tx:${runId}:val:${i}`,
      simulation_run_id: runId,
      from_event_id: null,
      to_event_id: `validation:${v.expectationId}`,
      transition_kind: "validation_gate",
      recorded_at: run.completedAt ?? run.startedAt,
      metadata: { passed: v.passed, detail: v.detail },
    });
  });

  return out;
}

function auditEchoEvents(
  run: SimulationRun,
  scenarioId: string,
  auditRows: SimulationAuditRow[],
): ForensicTimelineEvent[] {
  const trace = traceIdForRun(run.id);
  return auditRows.map((row, idx) => ({
    timestamp: row.created_at,
    trace_id: trace,
    correlation_id: `corr:audit:${run.id}:${row.id}`,
    parent_event_id: null,
    source_agent: "supabase_audit_log",
    target_agent: "forensic_correlation",
    simulation_run_id: run.id,
    severity: "info" as ForensicSeverity,
    event_hash: sha256Hex(stableStringify({ audit_id: row.id, action: row.action, payload: row.payload })),
    simulation_event_id: `audit-echo-${row.id}`,
    synthetic_kind: row.action,
    scenario_id: scenarioId,
    lane: "observed_audit_echo" as const,
    payload_redacted_summary: `${row.action} (${String(row.id).slice(0, 8)}…)`,
  }));
}

function validationOutcomeEvents(
  run: SimulationRun,
  scenarioId: string,
  validations: ValidationResult[],
): ForensicTimelineEvent[] {
  const trace = traceIdForRun(run.id);
  const at = run.completedAt ?? run.startedAt;
  return validations.map((v, idx) => ({
    timestamp: at,
    trace_id: trace,
    correlation_id: `corr:validation:${run.id}:${v.expectationId}`,
    parent_event_id: null,
    source_agent: "simulator_validator",
    target_agent: "forensic_correlation",
    simulation_run_id: run.id,
    severity: v.passed ? ("info" as ForensicSeverity) : ("high" as ForensicSeverity),
    event_hash: sha256Hex(stableStringify({ expectationId: v.expectationId, passed: v.passed, detail: v.detail })),
    simulation_event_id: `validation-${v.expectationId}-${idx}`,
    synthetic_kind: "validation.result",
    scenario_id: scenarioId,
    lane: "validation_outcome" as const,
    payload_redacted_summary: `${v.expectationId}: ${v.passed ? "PASS" : "FAIL"} — ${v.detail.slice(0, 160)}`,
  }));
}

function mergeChronological(
  synthetic: ForensicTimelineEvent[],
  extras: ForensicTimelineEvent[],
): ForensicTimelineEvent[] {
  return [...synthetic, ...extras].sort((a, b) => {
    const ta = Date.parse(a.timestamp);
    const tb = Date.parse(b.timestamp);
    if (ta !== tb) return ta - tb;
    return a.simulation_event_id.localeCompare(b.simulation_event_id);
  });
}

function buildIncidentReconstructionMarkdown(doc: ForensicTimelineDocument): string {
  const lines: string[] = [
    "# Incident reconstruction (simulation forensics)",
    "",
    doc.architecture_note,
    "",
    `**Run:** \`${doc.simulation_run_id}\`  `,
    `**Scenario:** \`${doc.scenario_id}\`  `,
    `**Generated:** ${doc.generated_at}  `,
    "",
    "## Chronology (synthetic emits + correlated echoes)",
    "",
    "| # | Time (ISO) | Lane | Event id | Kind | Severity | Summary |",
    "|---|------------|------|----------|------|----------|---------|",
  ];

  doc.events.forEach((e, i) => {
    const sum = e.payload_redacted_summary.replace(/\|/g, "\\|");
    lines.push(
      `| ${i + 1} | ${e.timestamp} | ${e.lane} | \`${e.simulation_event_id}\` | ${e.synthetic_kind} | ${e.severity} | ${sum} |`,
    );
  });

  lines.push("", "## Event transitions (persisted ledger)", "");
  doc.event_transitions.slice(0, 80).forEach((t) => {
    lines.push(
      `- **${t.transition_kind}** \`${t.transition_id}\` @ ${t.recorded_at}: ${t.from_event_id ?? "∅"} → \`${t.to_event_id}\``,
    );
  });
  if (doc.event_transitions.length > 80) {
    lines.push(`- … (${doc.event_transitions.length - 80} more transitions omitted)`);
  }

  lines.push("", "## Anomalies", "");
  if (doc.anomalies.duplicate_event_hashes.length === 0 && doc.anomalies.orphaned_parent_references.length === 0 && doc.anomalies.missing_workflow_transitions.length === 0) {
    lines.push("_No duplicate hashes, orphaned parents, or validator-reported workflow gaps detected in this bundle._");
  } else {
    if (doc.anomalies.duplicate_event_hashes.length) {
      lines.push("### Duplicate event hashes");
      doc.anomalies.duplicate_event_hashes.forEach((d) => {
        lines.push(`- \`${d.event_hash.slice(0, 16)}…\`: ${d.simulation_event_ids.join(", ")}`);
      });
    }
    if (doc.anomalies.orphaned_parent_references.length) {
      lines.push("### Orphaned parent references");
      doc.anomalies.orphaned_parent_references.forEach((o) => lines.push(`- ${o}`));
    }
    if (doc.anomalies.missing_workflow_transitions.length) {
      lines.push("### Missing or failed workflow correlation (validator view)");
      doc.anomalies.missing_workflow_transitions.forEach((m) =>
        lines.push(`- **${m.expectation_id}:** ${m.detail}`),
      );
    }
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    "Rows labeled **synthetic_emit** are emitted by the lab runner only. Rows labeled **observed_audit_echo** (when present) reflect reads from `audit_logs` captured during the observation window — they represent **real** SecureWatch360 persistence, not simulator-side remediation.",
    "",
  );

  return lines.join("\n");
}

/**
 * Reconstruct a full forensic timeline from a persisted simulation bundle (and optional audit rows).
 */
export function reconstructForensicTimeline(input: ReconstructForensicTimelineInput): ForensicTimelineDocument {
  const scenarioId = input.run.scenarioId;
  const scenario = input.scenario ?? undefined;
  const emissions =
    input.emissions ?? extractEmissionsFromStructuredReport(input.structuredReport ?? undefined) ?? undefined;
  const sorted = sortEvents(input.run.events ?? []);
  const trace = traceIdForRun(input.run.id);

  const syntheticEvents: ForensicTimelineEvent[] = sorted.map((ev, index) => ({
    timestamp: ev.simulatedAt,
    trace_id: trace,
    correlation_id: correlationIdFor(input.run.id, index, ev),
    parent_event_id: parentEventId(sorted, index),
    source_agent: "simulator_synthetic_emitter",
    target_agent: targetAgentForSyntheticKind(ev.kind),
    simulation_run_id: input.run.id,
    severity: eventSeverity(ev, scenario ?? null),
    event_hash: hashSimulatedEvent(ev, scenarioId),
    simulation_event_id: ev.id,
    synthetic_kind: ev.kind,
    scenario_id: scenarioId,
    lane: "synthetic_emit",
    payload_redacted_summary: redactedSummary(ev),
  }));

  const correlationExtras: ForensicTimelineEvent[] = [];
  sorted.forEach((ev, idx) => {
    const em = emissions?.[idx];
    if (!em?.auditLogId && em?.ingest === undefined && !em?.inject_error) return;
    correlationExtras.push({
      timestamp: ev.simulatedAt,
      trace_id: trace,
      correlation_id: `corr:emit:${input.run.id}:${idx}`,
      parent_event_id: ev.id,
      source_agent: "simulator_orchestration_sink",
      target_agent: em?.inject_error ? "sink_injected_failure" : "securewatch360_platform",
      simulation_run_id: input.run.id,
      severity: em?.inject_error ? ("high" as ForensicSeverity) : ("info" as ForensicSeverity),
      event_hash: sha256Hex(
        stableStringify({
          emission: { auditLogId: em.auditLogId, mode: em.mode, inject: em.inject_error },
        }),
      ),
      simulation_event_id: `correlation-${ev.id}`,
      synthetic_kind: "orchestration.correlation",
      scenario_id: scenarioId,
      lane: "orchestration_correlation",
      payload_redacted_summary: em.inject_error
        ? `inject_error: ${em.inject_error.type}`
        : `audit=${em.auditLogId ?? "none"}; ingest=${em.ingest !== undefined ? "present" : "absent"}`,
    });
  });

  const auditEchoes = input.auditRows?.length
    ? auditEchoEvents(input.run, scenarioId, input.auditRows)
    : [];

  const validationEvents = validationOutcomeEvents(input.run, scenarioId, input.result.validations);

  const events = mergeChronological(syntheticEvents, [...correlationExtras, ...auditEchoes, ...validationEvents]);

  const transitions = buildTransitions(input.run, sorted, emissions, input.result.validations);
  const anomalies = collectAnomalies(syntheticEvents, input.result.validations, scenario ?? null);

  const doc: ForensicTimelineDocument = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    simulation_run_id: input.run.id,
    scenario_id: scenarioId,
    architecture_note: ARCH_NOTE,
    events,
    event_transitions: transitions,
    anomalies,
    incident_reconstruction_markdown: "",
  };
  doc.incident_reconstruction_markdown = buildIncidentReconstructionMarkdown(doc);
  return doc;
}

/** Step-through iterator over merged forensic events (ascending time). */
export function* replayForensicTimelineStepwise(
  doc: ForensicTimelineDocument,
): Generator<ForensicTimelineEvent, void, unknown> {
  for (const e of doc.events) {
    yield e;
  }
}

export function exportTimelineAsJson(doc: ForensicTimelineDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function exportTimelineAsMarkdown(doc: ForensicTimelineDocument): string {
  const lines: string[] = [
    "# Forensic simulation timeline",
    "",
    `**Run:** \`${doc.simulation_run_id}\`  `,
    `**Scenario:** \`${doc.scenario_id}\`  `,
    `**Generated:** ${doc.generated_at}  `,
    "",
    doc.architecture_note,
    "",
    "## Events",
    "",
  ];
  doc.events.forEach((e, i) => {
    lines.push(`### ${i + 1}. ${e.lane} — \`${e.simulation_event_id}\``, "");
    lines.push(`- **Time:** ${e.timestamp}`);
    lines.push(`- **Trace:** \`${e.trace_id}\` | **Correlation:** \`${e.correlation_id}\``);
    lines.push(`- **Parent:** ${e.parent_event_id ?? "_none_"}`);
    lines.push(`- **Route:** ${e.source_agent} → ${e.target_agent}`);
    lines.push(`- **Severity:** ${e.severity} | **Hash:** \`${e.event_hash}\``);
    lines.push(`- **Summary:** ${e.payload_redacted_summary}`);
    lines.push("");
  });
  return lines.join("\n");
}

export interface PersistForensicTimelineOptions {
  runId: string;
  document: ForensicTimelineDocument;
  /** Defaults to \`SIMULATION_RESULTS_DIR\` or \`.simulation-results\`. */
  baseDir?: string;
}

/** Writes `{runId}-forensic-timeline.json`, `{runId}-forensic-timeline.md`, `{runId}-incident-reconstruction.md`. */
export async function persistForensicTimelineArtifacts(
  options: PersistForensicTimelineOptions,
): Promise<{ jsonPath: string; timelineMdPath: string; reconstructionMdPath: string }> {
  const root =
    options.baseDir?.trim() ||
    process.env.SIMULATION_RESULTS_DIR?.trim() ||
    path.join(process.cwd(), ".simulation-results");

  await fs.mkdir(root, { recursive: true });
  const id = options.runId.trim();
  const jsonPath = path.join(root, `${id}-forensic-timeline.json`);
  const timelineMdPath = path.join(root, `${id}-forensic-timeline.md`);
  const reconstructionMdPath = path.join(root, `${id}-incident-reconstruction.md`);

  await fs.writeFile(jsonPath, exportTimelineAsJson(options.document), "utf8");
  await fs.writeFile(timelineMdPath, exportTimelineAsMarkdown(options.document), "utf8");
  await fs.writeFile(reconstructionMdPath, options.document.incident_reconstruction_markdown, "utf8");

  return { jsonPath, timelineMdPath, reconstructionMdPath };
}
