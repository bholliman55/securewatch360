/**
 * Verifies remediation-oriented decision actions are present when policy requires remediation paths.
 */

import type { DecisionAction, DecisionOutput } from "@/types/policy";

const REMEDIATION_ACTIONS = new Set<DecisionAction>([
  "create_remediation",
  "auto_remediate",
  "escalate",
  "request_risk_acceptance",
]);

export type RemediationTriggerVerification = {
  /** At least one remediation-class action */
  remediation_trigger_observed: boolean;
  actions_matched: DecisionAction[];
  /** Policy expects remediation (strict modes) */
  remediation_expected: boolean;
  /** remediation_expected implies one of REMEDIATION_ACTIONS */
  satisfied: boolean;
  notes: string[];
};

export function verifyRemediationTriggers(
  decision: DecisionOutput,
  options?: { remediationExpected?: boolean }
): RemediationTriggerVerification {
  const remediation_expected = options?.remediationExpected === true;
  const actions_matched = REMEDIATION_ACTIONS.has(decision.action)
    ? [decision.action]
    : ([] as DecisionAction[]);

  const remediation_trigger_observed = REMEDIATION_ACTIONS.has(decision.action);

  const notes: string[] = [];
  if (decision.requiresApproval && decision.action === "auto_remediate") {
    notes.push("auto_remediate with requiresApproval may defer to human gate — acceptable.");
  }

  const satisfied =
    !remediation_expected ||
    (remediation_trigger_observed && actions_matched.length > 0);

  return {
    remediation_trigger_observed,
    actions_matched,
    remediation_expected,
    satisfied,
    notes,
  };
}
