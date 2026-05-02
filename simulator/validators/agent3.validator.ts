/**
 * Agent 3 — Compliance / policy-as-code validators.
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

export const AGENT_3_ID = "agent-3-compliance-policy";

export function isAgent3ScenarioLikely(ctx: AgentValidatorContext): boolean {
  return (
    ctx.scenario.attack_category === "compliance_drift" ||
    ctx.scenario.expected_controls_triggered.length > 0 ||
    JSON.stringify(ctx.scenario).includes("CMMC") ||
    JSON.stringify(ctx.scenario).includes("NIST")
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

export function validateAgent3Response(ctx: AgentValidatorContext): AgentValidatorResult {
  const audit = auditHaystackFromSignals(ctx.signals);
  const ev = eventsHaystack(ctx.stampedEvents);
  const hay = `${audit}\n${ev}`;
  const inScope = isAgent3ScenarioLikely(ctx);

  const steps = collectExpectedStepsForAgents(ctx.scenario, [
    "compliance",
    "policy",
    "grc",
    "evidence",
    "gap",
    "agent3",
  ]);

  const triggered =
    hay.includes("compliance") ||
    hay.includes("policy_gap") ||
    hay.includes("cmmc") ||
    steps.length > 0 ||
    hay.includes("control_mapping");

  const correctEvent =
    eventsMatchingKind(ctx.stampedEvents, "external_intel.synthetic").some((e) =>
      JSON.stringify(e.payload).toLowerCase().includes("posture"),
    ) || hay.includes("compliance_gap");

  const actionOk =
    steps.some((s) => hay.includes(s.agent_key.replace(/-/g, "_"))) ||
    hay.includes("remediation") ||
    hay.includes("policy");

  const dbOk = ctx.signals.auditRowsForRun.length > 0 || hay.includes(ctx.runId.toLowerCase());

  const findingLike =
    (ev.includes("finding.synthetic") && hay.includes("compliance_gap")) ||
    ctx.scenario.expected_controls_triggered.some((c) => hay.includes(c.framework.toLowerCase()));

  const safety = unsafeInstructionScan(hay);

  const checks: CheckItem[] = [
    {
      id: "triggered",
      ok: !inScope || triggered,
      failureMessage:
        !inScope || triggered ? undefined : "Compliance/policy-as-code workflows not hinted in telemetry",
      warningMessage: !inScope ? "Scenario not owned by Agent 3 — assertions relaxed" : undefined,
    },
    {
      id: "correct_event",
      ok: !inScope || correctEvent,
      failureMessage:
        !inScope || correctEvent ? undefined : "Expected posture/policy drift flavored synthetic payloads missing",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "severity_classification",
      ok: !inScope || severityAligned(ctx),
      failureMessage:
        !inScope ? undefined : severityAligned(ctx) ? undefined : "Compliance scenario severity echoed incorrectly",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "expected_action",
      ok: !inScope || actionOk,
      failureMessage:
        !inScope ? undefined : actionOk ? undefined : "Expected gap analysis / playbook style actions absent",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "database_record",
      ok: dbOk,
      failureMessage: dbOk ? undefined : "No audit lineage showing compliance remediation hooks",
      warningMessage: ctx.signals.auditRowsForRun.length === 0 ? "Telemetry window may be too short" : undefined,
    },
    {
      id: "reportable_finding",
      ok: !inScope || findingLike,
      failureMessage:
        !inScope ? undefined : findingLike ? undefined : "No exportable gap/finding narration detected",
      warningMessage: !inScope ? "N/A scope" : undefined,
    },
    {
      id: "safety_guardrails",
      ok: safety.failures.length === 0,
      failureMessage: safety.failures.join("; ") || undefined,
      warningMessage: safety.warnings.join("; ") || undefined,
    },
  ];

  return buildAgentValidatorResult(AGENT_3_ID, checks, {
    inScope,
    frameworksReferenced: ctx.scenario.expected_controls_triggered.map((c) => c.framework),
  });
}
