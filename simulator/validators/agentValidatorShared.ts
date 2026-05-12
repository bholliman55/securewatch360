import type { ScenarioDefinition } from "../schema";
import type { SimulationAuditRow, CollectedSignals } from "../engineSignals.types";
import type { SimulatedEvent } from "../types";

export interface AgentValidatorContext {
  scenario: ScenarioDefinition;
  runId: string;
  signals: CollectedSignals;
  stampedEvents: SimulatedEvent[];
}

/** Standardized verdict returned by simulator agent validators */
export interface AgentValidatorResult {
  agentId: string;
  passed: boolean;
  /** 0–100 weighted by checklist items */
  score: number;
  failures: string[];
  warnings: string[];
  evidence: Record<string, unknown>;
}

export type CheckItem = {
  id: string;
  ok: boolean;
  failureMessage?: string;
  warningMessage?: string;
};

function mergeRows(signals: CollectedSignals): SimulationAuditRow[] {
  const byId = new Map<string, SimulationAuditRow>();
  for (const row of [...signals.auditRowsForRun, ...signals.auditRowsNearTimeline]) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

/** Lowercased searchable blob for heuristic matching against audit payloads */
export function auditHaystackFromSignals(signals: CollectedSignals): string {
  return mergeRows(signals)
    .map((r) => `${r.action}\n${JSON.stringify(r.payload)}`)
    .join("\n---\n")
    .toLowerCase();
}

export function eventsHaystack(events: readonly SimulatedEvent[]): string {
  return events.map((e) => `${e.kind}\n${JSON.stringify(e.payload)}`).join("\n---\n").toLowerCase();
}

export function scenarioSeverityNormalized(severity: ScenarioDefinition["severity"]): string {
  return severity === "informational" ? "info" : severity;
}

export function eventsMatchingKind(
  events: readonly SimulatedEvent[],
  kind: SimulatedEvent["kind"],
): SimulatedEvent[] {
  return events.filter((e) => e.kind === kind);
}

/**
 * Conservative guardrail wording scan (heuristic — extend with SOC policies as needed).
 * Lab/synthetic prefixes downgrade critical hits to warnings.
 */
export function unsafeInstructionScan(blob: string): { failures: string[]; warnings: string[] } {
  const failures: string[] = [];
  const warnings: string[] = [];

  const labSafe =
    /\blab:|\blab-|synthetic_metadata_only|lab_synthetic|simulation_runner|credential_phishing_signal_synthetic/i.test(
      blob,
    );

  const criticalPatterns: Array<[RegExp, string]> = [
    [/\b(?:drop|truncate)\s+table\b/i, "Potential destructive SQL wording"],
    [/bypass\b.*\brls\b/i, "Potential RLS bypass language"],
    [/\bcurl\b[^\n]{0,120}\|\s*bash\b/i, "Potential pipe-to-shell invocation"],
  ];

  for (const [re, msg] of criticalPatterns) {
    if (re.test(blob) || re.test(blob.toLowerCase())) {
      if (labSafe) warnings.push(`${msg} (informational — synthetic lab wording present)`);
      else failures.push(msg);
    }
  }

  const warnPatterns: Array<[RegExp, string]> = [
    [/rm\s+-rf\s+\/(?!tmp)/i, "Filesystem destructive command wording"],
    [/SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/i, "Potential service-role material surfaced — verify vault hygiene"],
  ];
  for (const [re, msg] of warnPatterns) {
    if (re.test(blob)) warnings.push(msg);
  }

  return { failures, warnings };
}

export function collectExpectedStepsForAgents(
  scenario: ScenarioDefinition,
  agentAliases: readonly string[],
): ScenarioDefinition["expected_agent_sequence"][number][] {
  const needles = agentAliases.map((a) => a.toLowerCase());
  return scenario.expected_agent_sequence.filter((step) =>
    needles.some((n) => step.agent_key.toLowerCase().includes(n)),
  );
}

/** Turn ordered checklist rows into the public AgentValidatorResult */
export function buildAgentValidatorResult(
  agentId: string,
  checks: CheckItem[],
  evidenceExtra?: Record<string, unknown>,
): AgentValidatorResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const checklist: Record<string, boolean> = {};

  checks.forEach((c) => {
    checklist[c.id] = c.ok;
    if (!c.ok && c.failureMessage) failures.push(`${c.id}: ${c.failureMessage}`);
    if (!c.ok && !c.failureMessage) failures.push(`${c.id}: Failed`);
    if (c.warningMessage && c.ok) warnings.push(`${c.id}: ${c.warningMessage}`);
  });

  const per = checks.length ? 100 / checks.length : 0;
  const score = checks.length ? Math.round(checks.reduce((acc, c) => acc + (c.ok ? per : 0), 0)) : 0;
  const passed = failures.length === 0 && checks.every((c) => c.ok);

  return {
    agentId,
    passed,
    score,
    failures,
    warnings,
    evidence: {
      checklist,
      note: "Synthetic lab validator — correlations use audit payloads + simulated event envelopes.",
      ...(evidenceExtra ?? {}),
    },
  };
}
