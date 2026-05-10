/**
 * Decision traces — ordered phases from input to final decision.
 */

import type { DecisionInput, DecisionOutput } from "@/types/policy";
import type { DecisionTrace, DecisionTraceStep } from "./types";

export function buildDecisionTrace(args: {
  input: DecisionInput;
  output: DecisionOutput;
  policy_engine?: "fallback" | "opa" | "merged";
}): DecisionTrace {
  const steps: DecisionTraceStep[] = [];
  let order = 0;

  steps.push({
    order: order++,
    phase: "input_normalization",
    description: "Decision input assembled from finding, asset, exposure, and tenant risk context.",
    data: {
      tenantId: args.input.tenantId,
      findingId: args.input.findingId ?? null,
      severity: args.input.severity ?? null,
      exposure: args.input.exposure ?? null,
    },
  });

  steps.push({
    order: order++,
    phase: "policy_scan",
    description: `Policies evaluated via ${args.policy_engine ?? "rules"} engine path.`,
    data: { matched_policy_count: args.output.matchedPolicies.length },
  });

  steps.push({
    order: order++,
    phase: "merge",
    description: "Precedence merge applied when multiple policy sources contributed (if enabled).",
    data: { reasonCodes: args.output.reasonCodes },
  });

  steps.push({
    order: order++,
    phase: "guardrails",
    description: "Operational guardrails may require approval or block autonomous execution.",
    data: {
      guardrailOutcome: args.output.metadata?.guardrailOutcome ?? null,
    },
  });

  steps.push({
    order: order++,
    phase: "remediation_routing",
    description: "Remediation router maps decision action to execution mode and adapters.",
    data: {
      action: args.output.action,
      autoRemediationAllowed: args.output.autoRemediationAllowed,
      requiresApproval: args.output.requiresApproval,
    },
  });

  steps.push({
    order: order++,
    phase: "final",
    description: "Final DecisionOutput persisted to policy_decisions / workflow state.",
    data: { action: args.output.action },
  });

  return { steps };
}
