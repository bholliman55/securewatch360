/**
 * Agent 1 — Scanner / external attack-surface recon validators.
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

export const AGENT_1_ID = "agent-1-scanner-external-recon";

export function isAgent1ScenarioLikely(ctx: AgentValidatorContext): boolean {
  const ev = eventsHaystack(ctx.stampedEvents);
  return (
    ctx.scenario.attack_category === "exposed_service" ||
    ctx.scenario.attack_category === "misconfigured_cloud_resource" ||
    eventsMatchingKind(ctx.stampedEvents, "external_intel.synthetic").length > 0 ||
    ev.includes("discovery") ||
    ev.includes("surface")
  );
}

function severityMatchesExpectation(ctx: AgentValidatorContext): boolean {
  const want = scenarioSeverityNormalized(ctx.scenario.severity);
  return ctx.stampedEvents.some((e) => {
    const s = e.payload.severity;
    if (typeof s !== "string") return false;
    const n = s.trim().toLowerCase() === "informational" ? "info" : s.trim().toLowerCase();
    return n === want.toLowerCase();
  });
}

export function validateAgent1Response(ctx: AgentValidatorContext): AgentValidatorResult {
  const audit = auditHaystackFromSignals(ctx.signals);
  const ev = eventsHaystack(ctx.stampedEvents);
  const combined = `${audit}\n${ev}`;

  const inScope = isAgent1ScenarioLikely(ctx);

  const aliases = ["scanner", "discovery", "recon", "external", "surface", "agent1"];
  const expectedSteps = collectExpectedStepsForAgents(ctx.scenario, aliases);

  const triggered =
    combined.includes("agent1") ||
    combined.includes("external_discovery") ||
    combined.includes("attack surface") ||
    expectedSteps.length > 0;

  const sawExternalIntel = eventsMatchingKind(ctx.stampedEvents, "external_intel.synthetic").length > 0;
  const correctEvent =
    sawExternalIntel ||
    ctx.scenario.attack_category === "exposed_service" ||
    ev.includes("cloud_posture");

  const severityOk = severityMatchesExpectation(ctx);

  const actionOk =
    expectedSteps.some((s) => combined.includes(s.agent_key.replace(/-/g, "_"))) ||
    combined.includes("remediation") ||
    combined.includes("scan");

  const dbRecord =
    ctx.signals.auditRowsForRun.length > 0 ||
    combined.includes(ctx.runId.toLowerCase());

  const findingLikely =
    ev.includes("finding") || eventsMatchingKind(ctx.stampedEvents, "finding.synthetic").length > 0;

  const safety = unsafeInstructionScan(combined);

  const checks: CheckItem[] = [
    {
      id: "triggered",
      ok: !inScope || triggered,
      failureMessage: !inScope
        ? undefined
        : triggered
          ? undefined
          : "No recon-related trigger signature in captured telemetry",
      warningMessage: !inScope ? "Scenario not primarily scoped to Agent 1 — assertions relaxed" : undefined,
    },
    {
      id: "correct_event",
      ok: !inScope || correctEvent,
      failureMessage: !inScope
        ? undefined
        : correctEvent
          ? undefined
          : "Expected external intel / exposure flavored synthetic events",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "severity_classification",
      ok: !inScope || severityOk,
      failureMessage: !inScope ? undefined : severityOk ? undefined : "Synthetic severities misaligned with scenario",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "expected_action",
      ok: !inScope || actionOk,
      failureMessage: !inScope ? undefined : actionOk ? undefined : "Remediation/scan style action hints not found",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "database_record",
      ok: dbRecord,
      failureMessage:
        dbRecord === false
          ? "Audit timeline did not include simulation-run correlated rows (check Supabase/wait tuning)"
          : undefined,
      warningMessage:
        ctx.signals.auditRowsForRun.length === 0 ? "Console-only runs often lack audit echoes" : undefined,
    },
    {
      id: "reportable_finding",
      ok: !inScope || findingLikely,
      failureMessage: !inScope ? undefined : findingLikely ? undefined : "Finding-shaped material not observed",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "safety_guardrails",
      ok: safety.failures.length === 0,
      failureMessage: safety.failures.join("; ") || undefined,
      warningMessage: safety.warnings.join("; ") || undefined,
    },
  ];

  return buildAgentValidatorResult(AGENT_1_ID, checks, {
    inScope,
    expectedStepMatches: expectedSteps.map((s) => s.id),
  });
}
