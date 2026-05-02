/**
 * SecureWatch360 — Autonomy scorecard for simulation runs.
 *
 * Produces bounded 0–1 rates (semantic ratios) plus 0–100 scores for reporting.
 * Timing fields may be null in local/mock modes when telemetry is insufficient.
 *
 * Overall score bands:
 * - 90–100: production-ready
 * - 75–89: strong but needs fixes
 * - 60–74: partially autonomous
 * - below 60: not ready
 */

import type { CollectedSignals } from "../engineSignals.types";
import type { ScenarioDefinition } from "../schema";
import type { SimulationResult, SimulationRun } from "../types";
import { auditHaystackFromSignals } from "../validators/agentValidatorShared";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";

/** Input bundle for scoring a finished simulation run */
export interface AutonomyScorecardInput {
  scenario: ScenarioDefinition;
  result: SimulationResult;
  /** Run envelope (typically includes stamped events used for timelines). */
  run: Pick<SimulationRun, "id" | "startedAt" | "completedAt" | "events">;
  signals: CollectedSignals;
  securewatchAgents: AgentValidatorResult[];
}

/** Exported metrics mirror dashboard / SAR-style snake_case identifiers. */
export interface AutonomyScorecard {
  detection_success_rate: number;
  agent_trigger_accuracy: number;
  remediation_success_rate: number;
  policy_enforcement_success_rate: number;
  /** 0–1 scale; higher implies more suspicion of benign noise being treated as incidents. */
  false_positive_risk: number;
  /** 0–1 scale; higher implies concern that real issues were missed. */
  false_negative_risk: number;
  /** 0–1 scale; higher implies more reliance on humans (gates, approvals, HIL). */
  human_intervention_required: number;
  time_to_detect_seconds: number | null;
  time_to_triage_seconds: number | null;
  time_to_remediate_seconds: number | null;
  /** 0–100 */
  report_quality_score: number;
  /** Weighted composite 0–100 */
  overall_autonomy_score: number;
  readiness_band: AutonomyReadinessBand;
}

export type AutonomyReadinessBand =
  | "production_ready"
  | "strong_needs_fixes"
  | "partially_autonomous"
  | "not_ready";

export function describeAutonomyReadiness(overall_autonomy_score: number): AutonomyReadinessBand {
  if (overall_autonomy_score >= 90) return "production_ready";
  if (overall_autonomy_score >= 75) return "strong_needs_fixes";
  if (overall_autonomy_score >= 60) return "partially_autonomous";
  return "not_ready";
}

/** Human-readable label for dashboards (no symbols that render poorly). */
export function autonomyReadinessLabel(band: AutonomyReadinessBand): string {
  switch (band) {
    case "production_ready":
      return "Production-ready (simulation)";
    case "strong_needs_fixes":
      return "Strong but needs fixes";
    case "partially_autonomous":
      return "Partially autonomous";
    default:
      return "Not ready";
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseIsoMs(iso?: string): number | undefined {
  if (!iso?.trim()) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

function millisToSeconds(delta: number): number {
  return Math.max(0, Math.round(delta / 1000));
}

/** Core agent-sequence validations (excludes aggregation / rule stubs). */
function agentSequenceValidations(scenario: ScenarioDefinition, validations: SimulationResult["validations"]) {
  const ids = new Set(scenario.expected_agent_sequence.map((s) => s.id));
  return validations.filter((v) => ids.has(v.expectationId));
}

function controlsValidation(result: SimulationResult) {
  return result.validations.find((v) => v.expectationId === "aggregation-controls");
}

/** Audit + event text for heuristic keyword scans. */
function combinedHaystack(signals: CollectedSignals, result: SimulationResult, events: SimulationRun["events"]) {
  const audit = auditHaystackFromSignals(signals);
  const val = result.validations.map((v) => `${v.expectationId} ${v.detail}`).join("\n").toLowerCase();
  const ev = events.map((e) => `${e.kind} ${JSON.stringify(e.payload)}`).join("\n").toLowerCase();
  return `${audit}\n${val}\n${ev}`;
}

function isAttackPlaybook(
  scenario: ScenarioDefinition,
): scenario is ScenarioDefinition & {
  playbook_kind: "safe_synthetic_lab";
  expected_human_approval_gates: { gate: string }[];
  expected_autonomous_remediation: { synthetic_action: string }[];
} {
  return (
    "playbook_kind" in scenario &&
    (scenario as { playbook_kind?: string }).playbook_kind === "safe_synthetic_lab" &&
    Array.isArray((scenario as { expected_human_approval_gates?: unknown }).expected_human_approval_gates) &&
    Array.isArray((scenario as { expected_autonomous_remediation?: unknown }).expected_autonomous_remediation)
  );
}

/**
 * Compute autonomy metrics and overall 0–100 score for one simulation outcome.
 *
 * Ratios (`*_success_rate`, risk, intervention) are normalized to [0,1].
 * Timing nulls indicate insufficient telemetry (common in `local` observation mode).
 */
export function computeAutonomyScorecard(input: AutonomyScorecardInput): AutonomyScorecard {
  const { scenario, result, run, signals, securewatchAgents } = input;
  const agentVals = agentSequenceValidations(scenario, result.validations);
  const auditsForRun = signals.auditRowsForRun.length;
  const auditsNear = signals.auditRowsNearTimeline.length;
  const hay = combinedHaystack(signals, result, run.events ?? []);

  // --- Detection: correlation strength between synthetic ingest and persisted audit trail
  let detection_success_rate =
    agentVals.length > 0 ? clamp01(agentVals.filter((v) => v.passed).length / agentVals.length) : clamp01(result.passed ? 0.95 : 0.45);
  if (auditsForRun > 0) {
    detection_success_rate = clamp01(detection_success_rate * 1.05);
  } else if (auditsNear === 0) {
    detection_success_rate = clamp01(detection_success_rate * 0.78);
  }

  // --- Agent validators: checklist-weighted simulator scores normalized to accuracy
  const agent_trigger_accuracy =
    securewatchAgents.length > 0
      ? clamp01(securewatchAgents.reduce((acc, a) => acc + a.score, 0) / (securewatchAgents.length * 100))
      : agentVals.length > 0
        ? clamp01(agentVals.filter((v) => v.passed).length / agentVals.length)
        : clamp01(result.passed ? 0.9 : 0.5);

  // --- Policy / controls aggregation row
  const ctrl = controlsValidation(result);
  const policy_enforcement_success_rate =
    ctrl != null ? (ctrl.passed ? 1 : 0.35) : result.passed ? 0.75 : 0.4;

  // --- Remediation: keyword + outcome blend (no exploitation semantics)
  const remediationHints =
    /\b(remediation|patch|isolate|quarantine|revoke|rollback|cab|chang(e|ing)|ticket)\b/i.test(hay);
  let remediation_success_rate =
    remediationHints ? clamp01(policy_enforcement_success_rate * 0.85 + 0.15) : clamp01(detection_success_rate * 0.9);
  if (scenario.expected_remediation?.human_in_the_loop === false) {
    remediation_success_rate = clamp01(remediation_success_rate + 0.05);
  }
  if (!remediationHints && !auditsForRun) {
    remediation_success_rate = clamp01(remediation_success_rate * 0.85);
  }
  remediation_success_rate = clamp01(remediation_success_rate);

  // --- FP / FN risks (orthogonal; both penalize autonomy when elevated)
  const warningMass = securewatchAgents.reduce((acc, a) => acc + a.warnings.length, 0);
  let false_positive_risk = clamp01(warningMass / 18 + (result.passed && auditsForRun === 0 ? 0.28 : 0));
  let false_negative_risk = clamp01(
    agentVals.filter((v) => !v.passed).length / Math.max(1, agentVals.length || 4) +
      (!result.passed ? 0.22 : 0) +
      (scenario.pass_fail_rules.require_all_agent_steps && agentVals.some((v) => !v.passed) ? 0.12 : 0),
  );

  false_positive_risk = clamp01(false_positive_risk);
  false_negative_risk = clamp01(false_negative_risk);

  // --- Human intervention burden from playbook gates + remediation HIL expectation
  let human_intervention_required = scenario.expected_remediation?.human_in_the_loop === true ? 0.45 : 0.18;
  if (isAttackPlaybook(scenario)) {
    const gates = scenario.expected_human_approval_gates.length;
    human_intervention_required = clamp01(human_intervention_required + gates * 0.12 + (gates > 3 ? 0.06 : 0));
  }

  human_intervention_required = clamp01(human_intervention_required);

  // --- Timings
  let time_to_detect_seconds: number | null = null;
  const emit0Ms = parseIsoMs(run.events?.[0]?.simulatedAt);
  const earlyAuditMs = signals.auditRowsForRun.reduce(
    (min, r) => {
      const t = parseIsoMs(r.created_at);
      if (t === undefined) return min;
      if (min === undefined || t < min) return t;
      return min;
    },
    undefined as number | undefined,
  );
  if (emit0Ms !== undefined && earlyAuditMs !== undefined) {
    time_to_detect_seconds = millisToSeconds(earlyAuditMs - emit0Ms);
  } else if (emit0Ms !== undefined && auditsForRun === 0) {
    const waitParsed = Number.parseInt(process.env.SIMULATION_AGENT_WAIT_MS ?? "", 10);
    const nominalWaitSec = Number.isFinite(waitParsed) ? Math.round(waitParsed / 1000) : 5;
    time_to_detect_seconds = nominalWaitSec * (result.passed ? 1 : 2);
  }

  let time_to_triage_seconds: number | null = null;
  const obsStartMs = parseIsoMs(signals.observationWindowStartIso);
  const obsEndMs = parseIsoMs(signals.observationWindowEndIso);
  if (obsStartMs !== undefined && obsEndMs !== undefined) {
    time_to_triage_seconds = millisToSeconds(obsEndMs - obsStartMs);
  } else if (parseIsoMs(run.startedAt) !== undefined && parseIsoMs(run.completedAt) !== undefined) {
    time_to_triage_seconds = millisToSeconds(parseIsoMs(run.completedAt)! - parseIsoMs(run.startedAt)!);
  }

  let time_to_remediate_seconds: number | null = null;
  const remEvent = run.events?.find((e) => e.kind === "remediation.execution.synthetic");
  if (remEvent && emit0Ms !== undefined) {
    const remMs = parseIsoMs(remEvent.simulatedAt);
    if (remMs !== undefined) {
      time_to_remediate_seconds = millisToSeconds(remMs - emit0Ms);
    }
  } else if (time_to_detect_seconds != null && time_to_triage_seconds != null) {
    time_to_remediate_seconds = time_to_detect_seconds + Math.round(time_to_triage_seconds * 0.6);
  } else if (time_to_detect_seconds != null) {
    time_to_remediate_seconds = Math.round(time_to_detect_seconds * 2.5);
  }

  // --- Report posture (scenario asks for richness; MVP runner seldom materializes bodies)
  const sectionCount = scenario.expected_report_sections.length;
  let report_quality_score = Math.round(Math.min(100, sectionCount * 12 + (result.passed ? 28 : 10)));
  if (scenario.pass_fail_rules.all_report_sections_required) {
    report_quality_score = Math.round(clamp01((report_quality_score / 100) * 0.92) * 100);
  }
  report_quality_score = Math.round(clamp01(report_quality_score / 100) * 100);

  // --- Weighted composite (each term scaled 0–100; weights sum to 1)
  const tDetection = detection_success_rate * 100;
  const tAgents = agent_trigger_accuracy * 100;
  const tRemediation = remediation_success_rate * 100;
  const tPolicy = policy_enforcement_success_rate * 100;
  const tFpInv = (1 - false_positive_risk) * 100;
  const tFnInv = (1 - false_negative_risk) * 100;
  const tHumanInv = (1 - human_intervention_required) * 100;

  // Small additive bonus when modeled detect/triage timelines are brisk
  let fastBonus = 0;
  if (time_to_detect_seconds != null && time_to_detect_seconds < 180) fastBonus += 1.25;
  if (time_to_triage_seconds != null && time_to_triage_seconds < 600) fastBonus += 1.25;

  const rawOverall =
    tDetection * 0.14 +
    tAgents * 0.22 +
    tRemediation * 0.13 +
    tPolicy * 0.13 +
    tFpInv * 0.14 +
    tFnInv * 0.12 +
    tHumanInv * 0.09 +
    report_quality_score * 0.03;
  let overallRounded = Math.min(100, Math.max(0, Math.round(rawOverall + fastBonus)));

  const readiness_band = describeAutonomyReadiness(overallRounded);

  return {
    detection_success_rate: clamp01(detection_success_rate),
    agent_trigger_accuracy: clamp01(agent_trigger_accuracy),
    remediation_success_rate: clamp01(remediation_success_rate),
    policy_enforcement_success_rate: clamp01(policy_enforcement_success_rate),
    false_positive_risk: clamp01(false_positive_risk),
    false_negative_risk: clamp01(false_negative_risk),
    human_intervention_required: clamp01(human_intervention_required),
    time_to_detect_seconds,
    time_to_triage_seconds,
    time_to_remediate_seconds,
    report_quality_score,
    overall_autonomy_score: overallRounded,
    readiness_band,
  };
}
