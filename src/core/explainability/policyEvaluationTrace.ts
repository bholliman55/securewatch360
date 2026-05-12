/**
 * Policy evaluation traces — stepwise record of rules vs OPA vs merge.
 */

import type { DecisionOutput } from "@/types/policy";
import type { PolicyEvaluationTrace, PolicyEvaluationTraceEntry } from "./types";

export type PolicyEvaluationSourceInput = {
  engine: "fallback" | "opa" | "merged";
  matched_policy_count: number;
  errors?: string[];
  fallback_decision?: DecisionOutput | null;
  opa_decision?: DecisionOutput | null;
  merged_decision: DecisionOutput;
};

export function buildPolicyEvaluationTrace(src: PolicyEvaluationSourceInput): PolicyEvaluationTrace {
  const entries: PolicyEvaluationTraceEntry[] = [];
  let idx = 0;

  if (src.fallback_decision) {
    entries.push({
      step_index: idx++,
      source: "fallback_rules",
      outcome: "matched",
      detail: "Deterministic rules baseline produced a candidate decision.",
      partial_decision: {
        action: src.fallback_decision.action,
        reasonCodes: src.fallback_decision.reasonCodes,
        matchedPolicies: src.fallback_decision.matchedPolicies,
      },
    });
    for (const mp of src.fallback_decision.matchedPolicies) {
      entries.push({
        step_index: idx++,
        source: "fallback_rules",
        policy_id: mp.policyId,
        policy_name: mp.policyName,
        outcome: "matched",
        detail: "Rule-derived policy match contributed to baseline.",
      });
    }
  }

  if (src.opa_decision) {
    entries.push({
      step_index: idx++,
      source: "opa",
      outcome: "matched",
      detail: "OPA-compatible endpoint returned a structured decision payload.",
      partial_decision: {
        action: src.opa_decision.action,
        reasonCodes: src.opa_decision.reasonCodes,
        matchedPolicies: src.opa_decision.matchedPolicies,
      },
    });
    for (const mp of src.opa_decision.matchedPolicies) {
      entries.push({
        step_index: idx++,
        source: "opa",
        policy_id: mp.policyId,
        policy_name: mp.policyName,
        outcome: "matched",
        detail: "OPA evaluation matched this policy row.",
      });
    }
  } else if (src.engine !== "fallback") {
    entries.push({
      step_index: idx++,
      source: "opa",
      outcome: src.errors?.length ? "error" : "skipped",
      detail: src.errors?.length
        ? `OPA unavailable or invalid: ${src.errors.join("; ")}`
        : "OPA path not exercised for this evaluation.",
    });
  }

  if (src.engine === "merged" && src.fallback_decision && src.opa_decision) {
    entries.push({
      step_index: idx++,
      source: "precedence",
      outcome: "matched",
      detail: "Policy precedence merged OPA and rules outputs per product configuration.",
    });
  }

  const finalLabel =
    src.engine === "merged"
      ? "Final merged decision applied to workflow."
      : src.engine === "opa"
        ? "OPA decision applied (no merge)."
        : "Rules engine decision applied.";

  entries.push({
    step_index: idx++,
    source: src.engine === "merged" ? "merged" : src.engine === "opa" ? "opa" : "fallback_rules",
    outcome: "matched",
    detail: finalLabel,
    partial_decision: src.merged_decision,
  });

  return {
    entries,
    engine_label: src.engine,
  };
}
