/**
 * Human- and machine-readable JSON + Markdown reports for simulation runs.
 * Output defaults to `simulator/reports/output` (override with `reportOutputDir` or `SIMULATION_REPORT_OUTPUT_DIR`).
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ScenarioDefinition } from "../schema";
import type { CollectedSignals } from "../engineSignals.types";
import type { SimulationResult, SimulationRun, SimulatedEvent } from "../types";
import type { EmitCorrelation } from "../engines/eventEmitter";
import type { AutonomyScorecard } from "./autonomyScorecard";
import { autonomyReadinessLabel } from "./autonomyScorecard";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";

export const SIMULATION_RUN_REPORT_SCHEMA_VERSION = 1 as const;

function isSafeSyntheticPlaybook(
  scenario: ScenarioDefinition,
): scenario is ScenarioDefinition & {
  playbook_kind: "safe_synthetic_lab";
  simulated_timeline: Array<{
    t_offset_seconds: number;
    phase: string;
    synthetic_narrative: string;
  }>;
  expected_agents_triggered?: Array<{ agent_id: string; triggered_reason_synthetic: string }>;
  expected_autonomous_remediation?: Array<{ synthetic_action: string; automation_boundary: string }>;
  expected_human_approval_gates?: Array<{ gate: string; synthetic_rationale: string }>;
} {
  return (
    "playbook_kind" in scenario &&
    (scenario as { playbook_kind?: string }).playbook_kind === "safe_synthetic_lab"
  );
}

export interface SimulationRunReportTimelineEntry {
  /** Offset from run start when known; playbook uses authored offset. */
  t_offset_seconds: number | null;
  phase: string;
  narrative: string;
  source: "playbook" | "simulated_event";
}

export interface SimulationRunReportAgentRow {
  agent_id: string;
  validator_passed: boolean;
  validator_score: number;
  failures: string[];
  warnings: string[];
}

export interface SimulationRunReportActionRow {
  expectation_id: string;
  expected_agent_key: string;
  expected_capability: string;
  matched: boolean;
  detail: string;
}

export interface SimulationRunReportPolicyControlRow {
  framework: string;
  control_id?: string;
  control_label?: string;
}

export interface SimulationRunReportRemediation {
  expected_summary: string;
  human_in_the_loop?: boolean;
  expected_action_types?: string[];
  playbook_autonomous_actions?: Array<{
    synthetic_action: string;
    automation_boundary: string;
  }>;
  playbook_approval_gates?: Array<{
    gate: string;
    synthetic_rationale: string;
  }>;
  /** Free-text synthesis of signals (audit alignment, polls). */
  results_summary: string;
}

/** Canonical JSON shape saved next to Markdown twin. */
export interface SimulationRunHumanReport {
  meta: {
    generated_at_iso: string;
    schema_version: typeof SIMULATION_RUN_REPORT_SCHEMA_VERSION;
    report_kind: "securewatch360_simulation_run";
  };
  simulation_run_id: string;
  scenario_id: string;
  scenario_name: string;
  attack_category: string;
  severity: string;
  mitre_attack_techniques: string[];
  target_type: string;
  pass_fail_status: "PASS" | "FAIL";
  run_started_at: string;
  run_completed_at?: string;
  environment?: string;
  timeline: SimulationRunReportTimelineEntry[];
  agents_triggered: SimulationRunReportAgentRow[];
  playbook_expected_agents?: Array<{
    agent_id: string;
    triggered_reason_synthetic: string;
  }>;
  expected_vs_actual_actions: SimulationRunReportActionRow[];
  remediation_results: SimulationRunReportRemediation;
  policy_controls_tested: SimulationRunReportPolicyControlRow[];
  policy_controls_validation_detail?: string;
  autonomy_score: {
    overall_autonomy_score: number;
    readiness_band: AutonomyScorecard["readiness_band"];
    readiness_label: string;
    metrics: Pick<
      AutonomyScorecard,
      | "detection_success_rate"
      | "agent_trigger_accuracy"
      | "remediation_success_rate"
      | "policy_enforcement_success_rate"
      | "false_positive_risk"
      | "false_negative_risk"
      | "human_intervention_required"
      | "time_to_detect_seconds"
      | "time_to_triage_seconds"
      | "time_to_remediate_seconds"
      | "report_quality_score"
    >;
  };
  critical_failures: string[];
  recommended_fixes: string[];
  telemetry: {
    simulation_mode?: string;
    emissions_count: number;
    audit_rows_aligned: number;
    audit_rows_timeline_window: number;
    poll_iterations: number;
    observation_window_start: string;
    observation_window_end: string;
  };
}

export interface SimulationRunReportBuildInput {
  scenario: ScenarioDefinition;
  run: SimulationRun;
  result: SimulationResult;
  signals: CollectedSignals;
  emissions: EmitCorrelation[];
  autonomyScorecard: AutonomyScorecard;
  securewatchAgents: AgentValidatorResult[];
  /** When absent, `new Date()` is used at build time. */
  generatedAtIso?: string;
}

function buildTimeline(
  scenario: ScenarioDefinition,
  run: SimulationRun,
): SimulationRunReportTimelineEntry[] {
  if (isSafeSyntheticPlaybook(scenario) && Array.isArray(scenario.simulated_timeline)) {
    return scenario.simulated_timeline.map((row) => ({
      t_offset_seconds: row.t_offset_seconds,
      phase: row.phase,
      narrative: row.synthetic_narrative,
      source: "playbook" as const,
    }));
  }

  const startMs = Date.parse(run.startedAt);
  return (run.events ?? []).map((e: SimulatedEvent, idx: number) => {
    const t = Date.parse(e.simulatedAt);
    const offset =
      Number.isFinite(startMs) && Number.isFinite(t) ? Math.max(0, Math.round((t - startMs) / 1000)) : null;
    const title =
      typeof e.payload?.title === "string"
        ? (e.payload.title as string)
        : typeof e.payload?.alert_type === "string"
          ? String(e.payload.alert_type)
          : e.kind;
    return {
      t_offset_seconds: offset ?? idx * 10,
      phase: e.kind,
      narrative: title,
      source: "simulated_event" as const,
    };
  });
}

function remediationSection(
  scenario: ScenarioDefinition,
  result: SimulationResult,
  signals: CollectedSignals,
): SimulationRunReportRemediation {
  const base: SimulationRunReportRemediation = {
    expected_summary: scenario.expected_remediation.summary,
    human_in_the_loop: scenario.expected_remediation.human_in_the_loop,
    expected_action_types: scenario.expected_remediation.expected_action_types,
    results_summary: [
      `Outcome validations: ${result.validations.filter((v) => v.passed).length}/${result.validations.length} rows passed.`,
      `Audit rows aligned to run: ${signals.auditRowsForRun.length}; timeline window rows: ${signals.auditRowsNearTimeline.length}; poll_iterations=${signals.pollIterations}.`,
    ].join(" "),
  };

  if (isSafeSyntheticPlaybook(scenario)) {
    base.playbook_autonomous_actions = scenario.expected_autonomous_remediation;
    if (scenario.expected_human_approval_gates?.length) {
      base.playbook_approval_gates = scenario.expected_human_approval_gates.map((g) => ({
        gate: g.gate,
        synthetic_rationale: g.synthetic_rationale,
      }));
    }
  }

  return base;
}

function expectedVsActual(
  scenario: ScenarioDefinition,
  result: SimulationResult,
): SimulationRunReportActionRow[] {
  const map = new Map(result.validations.map((v) => [v.expectationId, v]));
  return scenario.expected_agent_sequence.map((step) => {
    const row = map.get(step.id);
    const matched = row?.passed ?? false;
    const detail =
      row?.detail ??
      (matched
        ? "Matched validation row absent but sequence implied pass (unexpected)."
        : "No validation row.");
    return {
      expectation_id: step.id,
      expected_agent_key: step.agent_key,
      expected_capability: step.capability,
      matched,
      detail,
    };
  });
}

function criticalFailuresList(
  result: SimulationResult,
  agents: AgentValidatorResult[],
): string[] {
  const out: string[] = [];

  for (const v of result.validations) {
    if (!v.passed)
      out.push(`[validation] ${v.expectationId}: ${v.detail}`.slice(0, 2000));
  }

  for (const a of agents) {
    for (const f of a.failures) {
      out.push(`[agent:${a.agentId}] ${f}`.slice(0, 2000));
    }
  }

  return out.slice(0, 80);
}

function recommendedFixes(
  scenario: ScenarioDefinition,
  result: SimulationResult,
  agents: AgentValidatorResult[],
  card: AutonomyScorecard,
): string[] {
  const fixes: string[] = [];

  for (const v of result.validations) {
    if (!v.passed) {
      fixes.push(
        `Clear expectation "${v.expectationId}": ${v.detail}. Add audit correlation or relax pass rules if this is a lab-only gap.`,
      );
    }
  }

  for (const a of agents) {
    if (!a.passed && a.failures.length > 0) {
      fixes.push(
        `Improve ${a.agentId} integration (score ${a.score}): ${a.failures.slice(0, 2).join("; ")}`,
      );
    }
  }

  if (card.overall_autonomy_score < 75) {
    fixes.push(
      `Raise autonomy (current ${card.overall_autonomy_score}, band ${card.readiness_band}): strengthen detection correlation, reduce false-positive/false-negative risk, or trim human gates where policy allows.`,
    );
  }

  if (scenario.pass_fail_rules.require_all_agent_steps) {
    fixes.push(
      "Scenario requires all agent steps; verify every expected_agent_sequence step produces observable side-effects in the active simulation mode.",
    );
  }

  if (result.passed && agents.some((a) => a.warnings.length > 3)) {
    fixes.push("Review validator warnings to avoid noisy production alerting.");
  }

  return fixes.slice(0, 25);
}

export function buildSimulationRunHumanReport(input: SimulationRunReportBuildInput): SimulationRunHumanReport {
  const {
    scenario,
    run,
    result,
    signals,
    emissions,
    autonomyScorecard,
    securewatchAgents,
    generatedAtIso,
  } = input;

  const controlsVal = result.validations.find((v) => v.expectationId === "aggregation-controls");

  return {
    meta: {
      generated_at_iso: generatedAtIso ?? new Date().toISOString(),
      schema_version: SIMULATION_RUN_REPORT_SCHEMA_VERSION,
      report_kind: "securewatch360_simulation_run",
    },
    simulation_run_id: run.id,
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    attack_category: scenario.attack_category,
    severity: scenario.severity,
    mitre_attack_techniques: [...scenario.mitre_attack_techniques],
    target_type: scenario.target_type,
    pass_fail_status: result.passed ? "PASS" : "FAIL",
    run_started_at: run.startedAt,
    ...(run.completedAt !== undefined ? { run_completed_at: run.completedAt } : {}),
    environment: run.environment,
    timeline: buildTimeline(scenario, run),
    agents_triggered: securewatchAgents.map((a) => ({
      agent_id: a.agentId,
      validator_passed: a.passed,
      validator_score: a.score,
      failures: [...a.failures],
      warnings: [...a.warnings],
    })),
    playbook_expected_agents: isSafeSyntheticPlaybook(scenario)
      ? scenario.expected_agents_triggered?.map((e) => ({
          agent_id: e.agent_id,
          triggered_reason_synthetic: e.triggered_reason_synthetic,
        }))
      : undefined,
    expected_vs_actual_actions: expectedVsActual(scenario, result),
    remediation_results: remediationSection(scenario, result, signals),
    policy_controls_tested: scenario.expected_controls_triggered.map((c) => ({
      framework: c.framework,
      ...(c.control_id !== undefined ? { control_id: c.control_id } : {}),
      ...(c.control_label !== undefined ? { control_label: c.control_label } : {}),
    })),
    policy_controls_validation_detail: controlsVal?.detail,
    autonomy_score: {
      overall_autonomy_score: autonomyScorecard.overall_autonomy_score,
      readiness_band: autonomyScorecard.readiness_band,
      readiness_label: autonomyReadinessLabel(autonomyScorecard.readiness_band),
      metrics: {
        detection_success_rate: autonomyScorecard.detection_success_rate,
        agent_trigger_accuracy: autonomyScorecard.agent_trigger_accuracy,
        remediation_success_rate: autonomyScorecard.remediation_success_rate,
        policy_enforcement_success_rate: autonomyScorecard.policy_enforcement_success_rate,
        false_positive_risk: autonomyScorecard.false_positive_risk,
        false_negative_risk: autonomyScorecard.false_negative_risk,
        human_intervention_required: autonomyScorecard.human_intervention_required,
        time_to_detect_seconds: autonomyScorecard.time_to_detect_seconds,
        time_to_triage_seconds: autonomyScorecard.time_to_triage_seconds,
        time_to_remediate_seconds: autonomyScorecard.time_to_remediate_seconds,
        report_quality_score: autonomyScorecard.report_quality_score,
      },
    },
    critical_failures: criticalFailuresList(result, securewatchAgents),
    recommended_fixes: recommendedFixes(scenario, result, securewatchAgents, autonomyScorecard),
    telemetry: {
      simulation_mode: emissions[0]?.mode,
      emissions_count: emissions.length,
      audit_rows_aligned: signals.auditRowsForRun.length,
      audit_rows_timeline_window: signals.auditRowsNearTimeline.length,
      poll_iterations: signals.pollIterations,
      observation_window_start: signals.observationWindowStartIso,
      observation_window_end: signals.observationWindowEndIso,
    },
  };
}

function mdCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
}

/** Render Markdown SAR-style briefing (tables + bullet lists). */
export function renderSimulationRunReportMarkdown(doc: SimulationRunHumanReport): string {
  const lines: string[] = [];
  lines.push(`# Simulation run report`);
  lines.push("");
  lines.push(`- **Simulation run ID:** \`${doc.simulation_run_id}\``);
  lines.push(`- **Scenario:** ${doc.scenario_name} (\`${doc.scenario_id}\`)`);
  lines.push(`- **Attack category:** ${doc.attack_category}`);
  lines.push(`- **Severity:** ${doc.severity}`);
  lines.push(`- **Outcome:** ${doc.pass_fail_status}`);
  lines.push(`- **Generated:** ${doc.meta.generated_at_iso}`);
  lines.push("");
  lines.push(`## Timeline`);
  lines.push("");
  lines.push("| Offset (s) | Phase | Narrative | Source |");
  lines.push("|------------|-------|-----------|--------|");
  for (const t of doc.timeline) {
    lines.push(
      `| ${t.t_offset_seconds ?? "—"} | ${mdCell(t.phase)} | ${mdCell(t.narrative)} | ${t.source} |`,
    );
  }
  lines.push("");
  lines.push(`## Agents (validator checklist)`);
  lines.push("");
  lines.push("| Agent | Passed | Score | Issues |");
  lines.push("|-------|--------|-------|--------|");
  for (const a of doc.agents_triggered) {
    const issues =
      [...a.failures.map((f) => `FAIL: ${f}`), ...a.warnings.map((w) => `WARN: ${w}`)].join("; ") ||
      "—";
    lines.push(`| ${a.agent_id} | ${a.validator_passed} | ${a.validator_score} | ${mdCell(issues)} |`);
  }
  if (doc.playbook_expected_agents?.length) {
    lines.push("");
    lines.push(`### Playbook expected agent triggers`);
    lines.push("");
    for (const p of doc.playbook_expected_agents) {
      lines.push(`- **${p.agent_id}:** ${p.triggered_reason_synthetic}`);
    }
  }
  lines.push("");
  lines.push(`## Expected vs actual actions`);
  lines.push("");
  lines.push("| Step | Expected | Matched | Detail |");
  lines.push("|------|----------|---------|--------|");
  for (const r of doc.expected_vs_actual_actions) {
    lines.push(
      `| ${r.expectation_id} | ${mdCell(`${r.expected_agent_key} / ${r.expected_capability}`)} | ${r.matched} | ${mdCell(r.detail)} |`,
    );
  }
  lines.push("");
  lines.push(`## Remediation results`);
  lines.push("");
  lines.push(`- **Summary:** ${mdCell(doc.remediation_results.expected_summary)}`);
  lines.push(`- **Human in the loop:** ${String(doc.remediation_results.human_in_the_loop ?? "unknown")}`);
  if (doc.remediation_results.expected_action_types?.length) {
    lines.push(`- **Expected action types:** ${doc.remediation_results.expected_action_types.join(", ")}`);
  }
  lines.push(`- **Signal summary:** ${mdCell(doc.remediation_results.results_summary)}`);
  if (doc.remediation_results.playbook_autonomous_actions?.length) {
    lines.push("");
    lines.push(`### Playbook autonomous actions (synthetic)`);
    for (const x of doc.remediation_results.playbook_autonomous_actions) {
      lines.push(`- ${mdCell(x.synthetic_action)} (\`${x.automation_boundary}\`)`);
    }
  }
  if (doc.remediation_results.playbook_approval_gates?.length) {
    lines.push("");
    lines.push(`### Human approval gates (synthetic)`);
    for (const g of doc.remediation_results.playbook_approval_gates) {
      lines.push(`- **${mdCell(g.gate)}:** ${mdCell(g.synthetic_rationale)}`);
    }
  }
  lines.push("");
  lines.push(`## Policy controls tested`);
  lines.push("");
  lines.push("| Framework | Control | Label |");
  lines.push("|-----------|---------|-------|");
  for (const c of doc.policy_controls_tested) {
    lines.push(
      `| ${mdCell(c.framework)} | ${mdCell(c.control_id ?? "—")} | ${mdCell(c.control_label ?? "—")} |`,
    );
  }
  if (doc.policy_controls_validation_detail) {
    lines.push("");
    lines.push(`**Validation:** ${mdCell(doc.policy_controls_validation_detail)}`);
  }
  lines.push("");
  lines.push(`## Autonomy score`);
  lines.push("");
  lines.push(`- **Overall:** ${doc.autonomy_score.overall_autonomy_score} / 100`);
  lines.push(`- **Readiness:** ${doc.autonomy_score.readiness_label} (\`${doc.autonomy_score.readiness_band}\`)`);
  const m = doc.autonomy_score.metrics;
  lines.push(
    `- **Rates:** detection ${(m.detection_success_rate * 100).toFixed(1)}%, agent accuracy ${(m.agent_trigger_accuracy * 100).toFixed(1)}%, remediation ${(m.remediation_success_rate * 100).toFixed(1)}%, policy ${(m.policy_enforcement_success_rate * 100).toFixed(1)}%`,
  );
  lines.push(
    `- **Risks:** FP ${(m.false_positive_risk * 100).toFixed(1)}%, FN ${(m.false_negative_risk * 100).toFixed(1)}%, human burden ${(m.human_intervention_required * 100).toFixed(1)}%`,
  );
  lines.push(
    `- **Times (s):** detect ${m.time_to_detect_seconds ?? "—"}, triage ${m.time_to_triage_seconds ?? "—"}, remediate ${m.time_to_remediate_seconds ?? "—"}`,
  );
  lines.push(`- **Report quality:** ${m.report_quality_score}`);
  lines.push("");
  lines.push(`## Critical failures`);
  lines.push("");
  if (doc.critical_failures.length === 0) {
    lines.push(`_None recorded._`);
  } else {
    for (const f of doc.critical_failures) {
      lines.push(`- ${mdCell(f)}`);
    }
  }
  lines.push("");
  lines.push(`## Recommended fixes`);
  lines.push("");
  for (const x of doc.recommended_fixes) {
    lines.push(`- ${mdCell(x)}`);
  }
  lines.push("");
  lines.push(`## Telemetry`);
  lines.push("");
  lines.push(`- mode: ${doc.telemetry.simulation_mode ?? "—"}`);
  lines.push(`- emissions: ${doc.telemetry.emissions_count}`);
  lines.push(
    `- audit aligned / timeline: ${doc.telemetry.audit_rows_aligned} / ${doc.telemetry.audit_rows_timeline_window}, polls ${doc.telemetry.poll_iterations}`,
  );
  lines.push(`- observation window: ${doc.telemetry.observation_window_start} → ${doc.telemetry.observation_window_end}`);
  lines.push("");
  return lines.join("\n");
}

export function defaultSimulationReportOutputDir(cwd: string = process.cwd()): string {
  const fromEnv = process.env.SIMULATION_REPORT_OUTPUT_DIR?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv);
  return path.join(cwd, "simulator", "reports", "output");
}

export interface WriteSimulationRunReportsResult {
  jsonPath: string;
  markdownPath: string;
}

/** Writes JSON + Markdown siblings for one run. */
export async function writeSimulationRunReports(
  input: SimulationRunReportBuildInput & { outputDirectory?: string; cwd?: string },
): Promise<WriteSimulationRunReportsResult> {
  const doc = buildSimulationRunHumanReport(input);
  const md = renderSimulationRunReportMarkdown(doc);
  const cwd = input.cwd ?? process.cwd();
  const dir = input.outputDirectory ?? defaultSimulationReportOutputDir(cwd);
  await fs.mkdir(dir, { recursive: true });

  const base = `${input.run.id}-securewatch-simulation-report`;
  const jsonPath = path.join(dir, `${base}.json`);
  const markdownPath = path.join(dir, `${base}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, `${md}\n`, "utf8");

  return { jsonPath, markdownPath };
}
