/**
 * Remediation reasoning — explain why remediation was or was not performed.
 */

import type { DecisionAction, DecisionOutput } from "@/types/policy";
import type { RemediationReasoning } from "./types";

const REMEDIATION_ACTIONS = new Set<DecisionAction>([
  "create_remediation",
  "auto_remediate",
  "escalate",
  "request_risk_acceptance",
]);

export function buildRemediationReasoning(output: DecisionOutput): RemediationReasoning {
  const bullets: string[] = [];
  const blocked_by: RemediationReasoning["blocked_by"] = [];

  const wantsRemediation = REMEDIATION_ACTIONS.has(output.action);
  const performedOrRecommended = wantsRemediation;

  if (output.action === "block") {
    bullets.push("Decision action is block — execution paths are denied; remediation is not performed.");
    blocked_by.push("policy_block");
  } else if (output.action === "monitor_only" || output.action === "allow") {
    bullets.push(
      `Decision action is ${output.action} — no remediation ticket or automated remediation was selected by policy.`,
    );
    blocked_by.push("no_auto_path");
  }

  if (output.reasonCodes.includes("finding_already_resolved")) {
    bullets.push("Finding was already resolved or accepted; remediation is not repeated.");
    blocked_by.push("finding_resolved");
  }

  if (output.requiresApproval && (output.action === "auto_remediate" || output.action === "create_remediation")) {
    bullets.push("Human approval is required before remediation can execute.");
    blocked_by.push("human_approval");
  }

  if (output.metadata?.guardrailOutcome === "blocked" || output.metadata?.guardrailOutcome === "approval_required") {
    bullets.push("Operational guardrails constrained autonomous remediation.");
    blocked_by.push("guardrail");
  }

  if (wantsRemediation) {
    bullets.push(
      `Remediation is indicated by action=${output.action}; autoRemediationAllowed=${String(output.autoRemediationAllowed)}, requiresApproval=${String(output.requiresApproval)}.`,
    );
  }

  if (bullets.length === 0) {
    bullets.push("No remediation-class action; policy selected monitor or allow posture.");
  }

  const narrative = performedOrRecommended
    ? "Policy and workflow selected a remediation-bearing outcome; execution depends on approval and guardrails."
    : "Policy did not select an active remediation execution path for this finding context.";

  return {
    remediation_performed_or_recommended: performedOrRecommended,
    narrative,
    bullets,
    ...(blocked_by.length > 0 ? { blocked_by: Array.from(new Set(blocked_by)) } : {}),
  };
}
