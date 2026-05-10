/**
 * Derives coarse policy enforcement posture from drift signals, Azure effects, and SW360 decisions.
 */

import type { DecisionOutput } from "@/types/policy";
import type { PolicyDriftResult } from "./driftDetection";
import { azureEvaluationsImplyEnforcement, type AzurePolicyEvaluationRecord } from "./azurePolicyVerifier";

export type PolicyEnforcementState =
  | "enforced"
  | "report_only"
  | "drift_detected"
  | "approval_gated"
  | "unknown";

export type EnforcementDerivationInput = {
  drift: PolicyDriftResult;
  azureEvaluations?: AzurePolicyEvaluationRecord[];
  mergedDecision?: DecisionOutput | null;
};

/**
 * Summarize enforcement posture for dashboards and verification reports.
 */
export function derivePolicyEnforcementState(input: EnforcementDerivationInput): PolicyEnforcementState {
  if (input.drift.drift_detected) return "drift_detected";

  const decision = input.mergedDecision;

  if (decision?.action === "block") return "enforced";

  if (input.azureEvaluations && input.azureEvaluations.length > 0) {
    if (azureEvaluationsImplyEnforcement(input.azureEvaluations)) return "enforced";
    const auditOnly = input.azureEvaluations.every(
      (e) => e.effect === "Audit" || e.effect === "AuditIfNotExists"
    );
    if (auditOnly) return "report_only";
  }

  if (decision?.requiresApproval && decision.action !== "allow") return "approval_gated";

  if (decision?.action === "monitor_only") return "report_only";

  return "unknown";
}
