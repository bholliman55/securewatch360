/**
 * Agent 2 — OSINT / vulnerability intelligence validators.
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

export const AGENT_2_ID = "agent-2-osint-vuln-intel";

export function isAgent2ScenarioLikely(ctx: AgentValidatorContext): boolean {
  const ev = eventsHaystack(ctx.stampedEvents);
  return (
    ctx.scenario.attack_category === "vulnerable_dependency" ||
    ctx.scenario.attack_category === "data_exfiltration_signal" ||
    eventsMatchingKind(ctx.stampedEvents, "external_intel.synthetic").length > 0 ||
    ev.includes("cve") ||
    ev.includes("intel")
  );
}

function severityAligned(ctx: AgentValidatorContext): boolean {
  const want = scenarioSeverityNormalized(ctx.scenario.severity);
  return ctx.stampedEvents.some((e) => {
    const s = e.payload.severity ?? e.payload.risk_rating;
    if (typeof s !== "string") return false;
    const n = s.trim().toLowerCase() === "informational" ? "info" : s.trim().toLowerCase();
    return n === want.toLowerCase();
  });
}

export function validateAgent2Response(ctx: AgentValidatorContext): AgentValidatorResult {
  const audit = auditHaystackFromSignals(ctx.signals);
  const ev = eventsHaystack(ctx.stampedEvents);
  const hay = `${audit}\n${ev}`;
  const inScope = isAgent2ScenarioLikely(ctx);

  const steps = collectExpectedStepsForAgents(ctx.scenario, [
    "intel",
    "osint",
    "agent2",
    "discovery",
    "vuln",
    "risk",
  ]);

  const triggered =
    hay.includes("agent2.osint_collection") ||
    hay.includes("external_intel") ||
    hay.includes("intelligence_events") ||
    steps.length > 0;

  const correctEvent =
    eventsMatchingKind(ctx.stampedEvents, "external_intel.synthetic").length > 0 || hay.includes("intel_type");

  const actionOk =
    steps.some((s) => hay.includes(s.agent_key.replace(/-/g, "_"))) ||
    hay.includes("enrich") ||
    hay.includes("catalog");

  const dbOk = ctx.signals.auditRowsForRun.length > 0 || hay.includes(ctx.runId.toLowerCase());

  const findingLike =
    ev.includes("finding.synthetic") || hay.includes("vulnerability") || hay.includes("cve");

  const safety = unsafeInstructionScan(hay);

  const checks: CheckItem[] = [
    {
      id: "triggered",
      ok: !inScope || triggered,
      failureMessage:
        !inScope || triggered ? undefined : "No OSINT/external intelligence trigger footprint observed",
      warningMessage: !inScope ? "Scenario not principally owned by Agent 2 — assertions relaxed" : undefined,
    },
    {
      id: "correct_event",
      ok: !inScope || correctEvent,
      failureMessage:
        !inScope || correctEvent ? undefined : "Expected external_intel or intel-envelope synthetic events missing",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "severity_classification",
      ok: !inScope || severityAligned(ctx),
      failureMessage: !inScope ? undefined : severityAligned(ctx) ? undefined : "Intel severities inconsistent with scenario",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "expected_action",
      ok: !inScope || actionOk,
      failureMessage: !inScope ? undefined : actionOk ? undefined : "Expected enrichment / catalog style actions absent",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "database_record",
      ok: dbOk,
      failureMessage: dbOk ? undefined : "No persistent audit breadcrumbs for simulated intel path",
      warningMessage: ctx.signals.auditRowsForRun.length === 0 ? "Consider increasing polling window" : undefined,
    },
    {
      id: "reportable_finding",
      ok: !inScope || findingLike,
      failureMessage: !inScope ? undefined : findingLike ? undefined : "No vulnerability intelligence finding material",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "safety_guardrails",
      ok: safety.failures.length === 0,
      failureMessage: safety.failures.join("; ") || undefined,
      warningMessage: safety.warnings.join("; ") || undefined,
    },
  ];

  return buildAgentValidatorResult(AGENT_2_ID, checks, {
    inScope,
    correlatedSteps: steps.map((s) => s.id),
  });
}
