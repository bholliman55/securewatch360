/**
 * Agent 4 — Training / phishing awareness validators.
 */

import type { AgentValidatorContext, AgentValidatorResult, CheckItem } from "./agentValidatorShared";
import {
  auditHaystackFromSignals,
  buildAgentValidatorResult,
  collectExpectedStepsForAgents,
  eventsHaystack,
  eventsMatchingKind,
  scenarioSeverityNormalized,
  unsafeInstructionScan,
} from "./agentValidatorShared";

export const AGENT_4_ID = "agent-4-awareness-phishing-training";

export function isAgent4ScenarioLikely(ctx: AgentValidatorContext): boolean {
  const ev = eventsHaystack(ctx.stampedEvents);
  return (
    ctx.scenario.attack_category === "phishing" ||
    ctx.scenario.attack_category === "suspicious_login" ||
    ev.includes("awareness") ||
    ev.includes("phish")
  );
}

function severityAligned(ctx: AgentValidatorContext): boolean {
  const want = scenarioSeverityNormalized(ctx.scenario.severity);
  return ctx.stampedEvents.some((e) => {
    const s = e.payload.severity;
    if (typeof s !== "string") return false;
    const n = s.trim().toLowerCase() === "informational" ? "info" : s.trim().toLowerCase();
    return n === want.toLowerCase();
  });
}

export function validateAgent4Response(ctx: AgentValidatorContext): AgentValidatorResult {
  const audit = auditHaystackFromSignals(ctx.signals);
  const ev = eventsHaystack(ctx.stampedEvents);
  const hay = `${audit}\n${ev}`;
  const inScope = isAgent4ScenarioLikely(ctx);

  const steps = collectExpectedStepsForAgents(ctx.scenario, ["awareness", "training", "phish", "hr", "education"]);

  const monitoringAwareness = eventsMatchingKind(ctx.stampedEvents, "monitoring.alert.synthetic").some((e) => {
    const t = e.payload.alert_type ?? e.payload.alertType;
    return typeof t === "string" && t.toLowerCase().includes("awareness");
  });

  const triggered =
    monitoringAwareness ||
    hay.includes("training_nudge") ||
    hay.includes("phish") ||
    steps.length > 0;

  const correctEvent = monitoringAwareness || ev.includes("credential_phishing_signal_synthetic");

  const actionOk =
    steps.some((s) => hay.includes(s.agent_key.replace(/-/g, "_"))) ||
    hay.includes("notify") ||
    hay.includes("slack_or_email");

  const dbOk = ctx.signals.auditRowsForRun.length > 0 || hay.includes(ctx.runId.toLowerCase());

  const findingLike = ev.includes("social_engineering_signal") || hay.includes("potential phishing");

  const safety = unsafeInstructionScan(hay);

  const checks: CheckItem[] = [
    {
      id: "triggered",
      ok: !inScope || triggered,
      failureMessage:
        !inScope || triggered ? undefined : "Human risk / awareness workflows not indicated in telemetry",
      warningMessage: !inScope ? "Scenario not principally owned by Agent 4 — assertions relaxed" : undefined,
    },
    {
      id: "correct_event",
      ok: !inScope || correctEvent,
      failureMessage:
        !inScope || correctEvent ? undefined : "Synthetic security_awareness alerts not present as expected",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "severity_classification",
      ok: !inScope || severityAligned(ctx),
      failureMessage: !inScope ? undefined : severityAligned(ctx) ? undefined : "Severity echo mismatch for humans",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "expected_action",
      ok: !inScope || actionOk,
      failureMessage:
        !inScope ? undefined : actionOk ? undefined : "Expected nudges / ticketing / comms actions not observed",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "database_record",
      ok: dbOk,
      failureMessage: dbOk ? undefined : "No audit breadcrumbs for awareness handling",
      warningMessage: ctx.signals.auditRowsForRun.length === 0 ? "Console mode often omits Supabase rows" : undefined,
    },
    {
      id: "reportable_finding",
      ok: !inScope || findingLike,
      failureMessage:
        !inScope ? undefined : findingLike ? undefined : "SOC-reportable human-risk finding not detected",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "safety_guardrails",
      ok: safety.failures.length === 0,
      failureMessage: safety.failures.join("; ") || undefined,
      warningMessage: safety.warnings.join("; ") || undefined,
    },
  ];

  return buildAgentValidatorResult(AGENT_4_ID, checks, {
    inScope,
    awarenessSteps: steps.map((s) => s.id),
  });
}
