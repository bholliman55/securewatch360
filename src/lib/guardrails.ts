import type { DecisionOutput } from "@/types/policy";
import type { RemediationActionType } from "@/types/remediation";

export const GUARDRAIL_OUTCOMES = [
  "allowed",
  "approval_required",
  "blocked",
] as const;

export type GuardrailOutcome = (typeof GUARDRAIL_OUTCOMES)[number];

export type GuardrailInput = {
  targetType: string;
  environment: "dev" | "staging" | "prod" | "unknown";
  severity: "info" | "low" | "medium" | "high" | "critical";
  actionType: RemediationActionType;
  exposure?: "internet" | "external" | "partner" | "internal" | "isolated" | "unknown";
  policyDecision: Pick<
    DecisionOutput,
    "action" | "requiresApproval" | "autoRemediationAllowed" | "riskAcceptanceAllowed"
  >;
};

export type GuardrailDecision = {
  outcome: GuardrailOutcome;
  reasons: string[];
  policyAllowsAutomation: boolean;
  metadata: Record<string, unknown>;
};

type GuardrailRule = {
  id: string;
  match: (input: GuardrailInput) => boolean;
  apply: (input: GuardrailInput) => GuardrailDecision;
};

const HIGH_RISK_ENVIRONMENTS = new Set(["prod"]);
const SAFE_AUTO_TARGET_TYPES = new Set(["container_image", "package_manifest", "dependency_manifest"]);
const HIGH_RISK_ACTION_TYPES = new Set<RemediationActionType>(["config_change", "isolate"]);

const rules: GuardrailRule[] = [
  {
    id: "policy-block-always-wins",
    match: (input) => input.policyDecision.action === "block",
    apply: () => ({
      outcome: "blocked",
      reasons: ["policy_denied_action"],
      policyAllowsAutomation: false,
      metadata: { ruleId: "policy-block-always-wins" },
    }),
  },
  {
    id: "policy-explicit-approval",
    match: (input) => input.policyDecision.requiresApproval,
    apply: () => ({
      outcome: "approval_required",
      reasons: ["policy_requires_human_approval"],
      policyAllowsAutomation: false,
      metadata: { ruleId: "policy-explicit-approval" },
    }),
  },
  {
    id: "automation-not-allowed-by-policy",
    match: (input) =>
      input.actionType === "auto_fix" && !input.policyDecision.autoRemediationAllowed,
    apply: () => ({
      outcome: "blocked",
      reasons: ["auto_remediation_not_allowed_by_policy"],
      policyAllowsAutomation: false,
      metadata: { ruleId: "automation-not-allowed-by-policy" },
    }),
  },
  {
    id: "critical-public-production-high-risk-actions",
    match: (input) =>
      HIGH_RISK_ENVIRONMENTS.has(input.environment) &&
      (input.severity === "critical" || input.severity === "high") &&
      (input.exposure === "internet" || input.exposure === "external") &&
      HIGH_RISK_ACTION_TYPES.has(input.actionType),
    apply: () => ({
      outcome: "approval_required",
      reasons: ["critical_public_asset_requires_human_review"],
      policyAllowsAutomation: true,
      metadata: { ruleId: "critical-public-production-high-risk-actions" },
    }),
  },
  {
    id: "prod-unsafe-target-for-auto-fix",
    match: (input) =>
      input.environment === "prod" &&
      input.actionType === "auto_fix" &&
      !SAFE_AUTO_TARGET_TYPES.has(input.targetType),
    apply: () => ({
      outcome: "approval_required",
      reasons: ["target_type_not_safe_for_prod_auto_execution"],
      policyAllowsAutomation: true,
      metadata: { ruleId: "prod-unsafe-target-for-auto-fix" },
    }),
  },
  {
    id: "default-allow",
    match: () => true,
    apply: (input) => ({
      outcome: "allowed",
      reasons: ["passes_initial_guardrails"],
      policyAllowsAutomation: input.policyDecision.autoRemediationAllowed,
      metadata: { ruleId: "default-allow" },
    }),
  },
];

/**
 * Guardrails are an operational safety layer after policy evaluation.
 * Use this before queuing automatic remediation execution.
 */
export function evaluateGuardrails(input: GuardrailInput): GuardrailDecision {
  for (const rule of rules) {
    if (!rule.match(input)) continue;
    return rule.apply(input);
  }

  return {
    outcome: "blocked",
    reasons: ["guardrail_rule_miss"],
    policyAllowsAutomation: false,
    metadata: { ruleId: "implicit-fallback-block" },
  };
}
