import type { DecisionAction, DecisionOutput, DecisionReason } from "@/types/policy";

type DecisionWithSource = {
  decision: DecisionOutput;
  source: string;
};

function isBlockAction(action: DecisionAction): boolean {
  return action === "block";
}

function isApprovalGate(decision: DecisionOutput): boolean {
  return decision.requiresApproval === true;
}

function mergeMatchedPolicies(
  decisions: DecisionWithSource[]
): Array<{ policyId: string; policyName?: string; version?: string }> {
  const merged = new Map<string, { policyId: string; policyName?: string; version?: string }>();
  for (const { decision } of decisions) {
    for (const policy of decision.matchedPolicies) {
      merged.set(policy.policyId, policy);
    }
  }
  return Array.from(merged.values());
}

function mergeReasonCodes(decisions: DecisionWithSource[]): DecisionReason[] {
  const merged = new Set<DecisionReason>();
  for (const { decision } of decisions) {
    for (const reason of decision.reasonCodes) {
      merged.add(reason);
    }
  }
  return Array.from(merged);
}

function chooseActionWithoutBlock(decisions: DecisionWithSource[]): DecisionAction {
  const hasApprovalGate = decisions.some(({ decision }) => isApprovalGate(decision));
  const hasEscalate = decisions.some(({ decision }) => decision.action === "escalate");
  const hasMonitorOnly = decisions.some(({ decision }) => decision.action === "monitor_only");
  const hasRemediation =
    decisions.some(({ decision }) => decision.action === "create_remediation") ||
    decisions.some(({ decision }) => decision.action === "auto_remediate");
  const hasRiskAcceptance = decisions.some(
    ({ decision }) => decision.action === "request_risk_acceptance"
  );
  const hasAutoRemediate = decisions.some(({ decision }) => decision.action === "auto_remediate");

  // Approval-required beats auto-remediate.
  if (hasApprovalGate) {
    if (hasEscalate) return "escalate";
    if (hasRemediation) return "create_remediation";
    if (hasRiskAcceptance) return "request_risk_acceptance";
    return "allow";
  }

  if (hasEscalate) return "escalate";
  if (hasAutoRemediate) return "auto_remediate";
  if (hasRemediation) return "create_remediation";
  if (hasMonitorOnly) return "monitor_only";
  if (hasRiskAcceptance) return "request_risk_acceptance";
  return "allow";
}

/**
 * Merge multiple policy outputs into a single DecisionOutput with explicit precedence:
 * 1) block/deny wins over everything
 * 2) approval-required beats auto-remediation
 * 3) risk acceptance can never override an explicit deny/block
 */
export function mergePolicyOutputs(decisions: DecisionWithSource[]): DecisionOutput {
  if (decisions.length === 0) {
    return {
      action: "allow",
      requiresApproval: false,
      autoRemediationAllowed: false,
      riskAcceptanceAllowed: true,
      reasonCodes: ["policy_not_matched"],
      matchedPolicies: [],
      metadata: {
        precedenceApplied: true,
        decisionSources: [],
      },
    };
  }

  const hasExplicitBlock = decisions.some(({ decision }) => isBlockAction(decision.action));
  const requiresApproval = decisions.some(({ decision }) => isApprovalGate(decision));
  const action = hasExplicitBlock ? "block" : chooseActionWithoutBlock(decisions);

  // Never allow these when we have explicit deny/block.
  const riskAcceptanceAllowed = hasExplicitBlock
    ? false
    : decisions.every(({ decision }) => decision.riskAcceptanceAllowed);

  // Approval-required beats auto-remediate.
  const autoRemediationAllowed =
    !hasExplicitBlock &&
    !requiresApproval &&
    decisions.some(({ decision }) => decision.autoRemediationAllowed);

  const mergedReasons = mergeReasonCodes(decisions);
  if (hasExplicitBlock) {
    mergedReasons.push("severity_threshold_exceeded");
  }

  return {
    action,
    requiresApproval: hasExplicitBlock ? true : requiresApproval,
    autoRemediationAllowed,
    riskAcceptanceAllowed,
    reasonCodes: Array.from(new Set(mergedReasons)),
    matchedPolicies: mergeMatchedPolicies(decisions),
    metadata: {
      precedenceApplied: true,
      decisionSources: decisions.map((row) => row.source),
    },
  };
}
