/**
 * Agent 5 — Monitoring / incident response validators.
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

export const AGENT_5_ID = "agent-5-monitoring-incident-response";

export function isAgent5ScenarioLikely(ctx: AgentValidatorContext): boolean {
  const ev = eventsHaystack(ctx.stampedEvents);
  return (
    ctx.scenario.attack_category === "ransomware_behavior" ||
    ctx.scenario.attack_category === "endpoint_compromise_signal" ||
    ctx.scenario.attack_category === "privilege_escalation_signal" ||
    eventsMatchingKind(ctx.stampedEvents, "monitoring.alert.synthetic").length > 0 ||
    ev.includes("edr")
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

export function validateAgent5Response(ctx: AgentValidatorContext): AgentValidatorResult {
  const audit = auditHaystackFromSignals(ctx.signals);
  const ev = eventsHaystack(ctx.stampedEvents);
  const hay = `${audit}\n${ev}`;
  const inScope = isAgent5ScenarioLikely(ctx);

  const steps = collectExpectedStepsForAgents(ctx.scenario, [
    "soc",
    "incident",
    "monitoring",
    "ir",
    "mdr",
    "agent5",
  ]);

  const hasMonitoring = eventsMatchingKind(ctx.stampedEvents, "monitoring.alert.synthetic").length > 0;

  const triggered =
    hasMonitoring ||
    hay.includes("monitoring.alert.received") ||
    hay.includes("war-room") ||
    steps.length > 0;

  const correctEvent = hasMonitoring || hay.includes("alert_type");

  const actionOk =
    steps.some((s) => hay.includes(s.agent_key.replace(/-/g, "_"))) ||
    hay.includes("escalat") ||
    hay.includes("isolate") ||
    hay.includes("runbook");

  const dbOk =
    ctx.signals.auditRowsForRun.length > 0 ||
    hay.includes("simulation.synthetic_event_emitted") ||
    hay.includes(ctx.runId.toLowerCase());

  const findingLike =
    eventsMatchingKind(ctx.stampedEvents, "finding.synthetic").length > 0 || hay.includes(`"createfinding":true`);

  const safety = unsafeInstructionScan(hay);

  const checks: CheckItem[] = [
    {
      id: "triggered",
      ok: !inScope || triggered,
      failureMessage:
        !inScope || triggered ? undefined : "Monitoring SOC pipeline not reflected in captured artifacts",
      warningMessage: !inScope ? "Scenario not principally owned by Agent 5 — assertions relaxed" : undefined,
    },
    {
      id: "correct_event",
      ok: !inScope || correctEvent,
      failureMessage:
        !inScope || correctEvent ? undefined : "Expected SIEM/EDR-shaped monitoring alerts missing",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "severity_classification",
      ok: !inScope || severityAligned(ctx),
      failureMessage: !inScope ? undefined : severityAligned(ctx) ? undefined : "Operational severity mapping incorrect",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "expected_action",
      ok: !inScope || actionOk,
      failureMessage:
        !inScope ? undefined : actionOk ? undefined : "Expected IR actions (escalation/containment) not detected",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "database_record",
      ok: dbOk,
      failureMessage: dbOk ? undefined : "Incident tracking / audit lineage absent",
      warningMessage: ctx.signals.auditRowsForRun.length === 0 ? "Expand Supabase polling for full validation" : undefined,
    },
    {
      id: "reportable_finding",
      ok: !inScope || findingLike,
      failureMessage:
        !inScope ? undefined : findingLike ? undefined : "SOC cannot export a concrete finding from these signals",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "safety_guardrails",
      ok: safety.failures.length === 0,
      failureMessage: safety.failures.join("; ") || undefined,
      warningMessage: safety.warnings.join("; ") || undefined,
    },
  ];

  return buildAgentValidatorResult(AGENT_5_ID, checks, {
    inScope,
    alertSteps: steps.map((s) => s.id),
  });
}
