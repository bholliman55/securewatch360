import type {
  DecisionAction,
  DecisionInput,
  DecisionOutput,
  DecisionReason,
} from "@/types/policy";
import { evaluateAgainstPolicies } from "@/lib/policyEvaluationService";

type EnginePolicyRef = {
  policyId: string;
  policyName: string;
  version: string;
};

type DecisionRule = {
  policy: EnginePolicyRef;
  applies: (input: DecisionInput) => boolean;
  apply: (state: MutableDecisionState, input: DecisionInput) => void;
};

type MutableDecisionState = {
  action: DecisionAction;
  requiresApproval: boolean;
  autoRemediationAllowed: boolean;
  riskAcceptanceAllowed: boolean;
  reasonCodes: Set<DecisionReason>;
  matchedPolicies: Array<{ policyId: string; policyName?: string; version?: string }>;
  metadata: Record<string, unknown>;
};

type DecisionProvider = {
  name: string;
  evaluate: (input: DecisionInput) => Promise<DecisionOutput>;
};

const AUTO_REMEDIATE_TARGET_TYPES = new Set(["container_image", "package_manifest", "dependency_manifest"]);
const PUBLIC_EXPOSURE = new Set(["internet", "external"]);
const RESOLVED_STATUSES = new Set(["resolved", "risk_accepted"]);

function withPolicy(state: MutableDecisionState, policy: EnginePolicyRef) {
  state.matchedPolicies.push({
    policyId: policy.policyId,
    policyName: policy.policyName,
    version: policy.version,
  });
}

function pickStrongerAction(current: DecisionAction, next: DecisionAction): DecisionAction {
  const order: DecisionAction[] = [
    "allow",
    "monitor_only",
    "request_risk_acceptance",
    "create_remediation",
    "auto_remediate",
    "escalate",
    "block",
  ];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function initialDecisionState(): MutableDecisionState {
  return {
    action: "allow",
    requiresApproval: false,
    autoRemediationAllowed: false,
    riskAcceptanceAllowed: true,
    reasonCodes: new Set<DecisionReason>(),
    matchedPolicies: [],
    metadata: {},
  };
}

const rules: DecisionRule[] = [
  {
    policy: {
      policyId: "sw360.rule.low-severity-monitor",
      policyName: "Low Severity Monitor-Only",
      version: "v1",
    },
    applies: (input) => input.severity === "low" || input.severity === "info",
    apply: (state) => {
      state.action = "monitor_only";
      state.requiresApproval = false;
      state.autoRemediationAllowed = false;
      state.riskAcceptanceAllowed = true;
      state.reasonCodes.add("low_severity_monitor_only");
    },
  },
  {
    policy: {
      policyId: "sw360.rule.critical-public-exposure",
      policyName: "Critical Public Exposure",
      version: "v1",
    },
    applies: (input) =>
      input.severity === "critical" &&
      !!input.exposure &&
      PUBLIC_EXPOSURE.has(input.exposure) &&
      !RESOLVED_STATUSES.has(input.currentFindingStatus ?? ""),
    apply: (state, input) => {
      const targetType = (input.targetType ?? "").toLowerCase();
      if (AUTO_REMEDIATE_TARGET_TYPES.has(targetType)) {
        state.action = pickStrongerAction(state.action, "auto_remediate");
        state.autoRemediationAllowed = true;
        state.requiresApproval = false;
        state.reasonCodes.add("controlled_auto_remediation_allowed");
      } else {
        state.action = pickStrongerAction(state.action, "create_remediation");
        state.autoRemediationAllowed = false;
        state.requiresApproval = true;
      }
      state.riskAcceptanceAllowed = false;
      state.reasonCodes.add("internet_exposed_asset");
      state.reasonCodes.add("critical_asset_type");
    },
  },
  {
    policy: {
      policyId: "sw360.rule.compliance-documentation",
      policyName: "Compliance Documentation Required",
      version: "v1",
    },
    applies: (input) => {
      if (!input.complianceImpact) return false;
      return ["moderate", "high", "critical"].includes(input.complianceImpact);
    },
    apply: (state) => {
      state.requiresApproval = true;
      state.reasonCodes.add("compliance_control_required");
      state.reasonCodes.add("documentation_required");
      state.metadata.documentationRequired = true;
    },
  },
  {
    policy: {
      policyId: "sw360.rule.unresolved-high-remediation",
      policyName: "Unresolved High Severity Requires Remediation",
      version: "v1",
    },
    applies: (input) =>
      (input.severity === "high" || input.severity === "critical") &&
      !RESOLVED_STATUSES.has(input.currentFindingStatus ?? ""),
    apply: (state) => {
      state.action = pickStrongerAction(state.action, "create_remediation");
      state.reasonCodes.add("severity_threshold_exceeded");
      state.reasonCodes.add("remediation_required");
    },
  },
];

export async function evaluateDecisionWithRules(input: DecisionInput): Promise<DecisionOutput> {
  const state = initialDecisionState();

  for (const rule of rules) {
    if (!rule.applies(input)) continue;
    withPolicy(state, rule.policy);
    rule.apply(state, input);
  }

  if (state.matchedPolicies.length === 0) {
    state.reasonCodes.add("policy_not_matched");
  }

  return {
    action: state.action,
    requiresApproval: state.requiresApproval,
    autoRemediationAllowed: state.autoRemediationAllowed,
    riskAcceptanceAllowed: state.riskAcceptanceAllowed,
    reasonCodes: Array.from(state.reasonCodes),
    matchedPolicies: state.matchedPolicies,
    metadata: state.metadata,
  };
}

const opaProvider: DecisionProvider = {
  name: "opa",
  evaluate: async (input: DecisionInput) => {
    const result = await evaluateAgainstPolicies({
      input,
      fallbackEvaluator: evaluateDecisionWithRules,
    });
    return result.decision;
  },
};

const rulesProvider: DecisionProvider = {
  name: "rules",
  evaluate: evaluateDecisionWithRules,
};

function resolveProvider(): DecisionProvider {
  const requested = (process.env.DECISION_ENGINE_PROVIDER ?? "rules").toLowerCase();
  if (requested === "opa") {
    return opaProvider;
  }
  return rulesProvider;
}

/**
 * Central decision entrypoint for SecureWatch360.
 * All decision callers should use this function so policy logic stays in one place.
 */
export async function evaluateDecision(input: DecisionInput): Promise<DecisionOutput> {
  const provider = resolveProvider();
  try {
    return await provider.evaluate(input);
  } catch (error) {
    // If OPA provider fails, fail open to rules for v4 bootstrap safety.
    if (provider.name !== "rules") {
      const fallback = await evaluateDecisionWithRules(input);
      return {
        ...fallback,
        metadata: {
          ...(fallback.metadata ?? {}),
          sw360_decision_engine_fallback: "rules_after_provider_error",
          sw360_decision_engine_provider: provider.name,
          sw360_decision_engine_error: error instanceof Error ? error.message : String(error),
        },
      };
    }
    throw error;
  }
}
