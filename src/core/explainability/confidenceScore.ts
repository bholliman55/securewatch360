/**
 * Confidence scoring for explainability — heuristic blend of policy agreement and input strength.
 */

import type { DecisionInput, DecisionOutput } from "@/types/policy";
import type { ConfidenceBreakdown } from "./types";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Derive an overall confidence score and factor breakdown from decision context.
 */
export function computeDecisionConfidence(args: {
  input: DecisionInput;
  output: DecisionOutput;
  policy_engine?: "fallback" | "opa" | "merged";
  evaluation_errors?: string[];
}): ConfidenceBreakdown {
  const factors: ConfidenceBreakdown["factors"] = [];

  let inputStrength = 0.55;
  if (args.input.findingId) inputStrength += 0.15;
  if (args.input.severity === "critical" || args.input.severity === "high") inputStrength += 0.1;
  if (args.input.exposure === "internet" || args.input.exposure === "external") inputStrength += 0.1;
  inputStrength = clamp01(inputStrength);
  factors.push({
    id: "input_completeness",
    weight: 0.25,
    score: inputStrength,
    rationale: "More correlated signals (finding, severity, exposure) increase trace confidence.",
  });

  const policyCount = args.output.matchedPolicies?.length ?? 0;
  const policyStrength = clamp01(0.35 + Math.min(policyCount, 5) * 0.1);
  factors.push({
    id: "policy_match_surface",
    weight: 0.25,
    score: policyStrength,
    rationale: `${policyCount} policies contributed explicit matches to the merged view.`,
  });

  let engineScore = 0.55;
  if (args.policy_engine === "merged") engineScore = 0.85;
  else if (args.policy_engine === "opa") engineScore = 0.78;
  else if (args.policy_engine === "fallback") engineScore = 0.62;
  factors.push({
    id: "evaluation_engine",
    weight: 0.2,
    score: engineScore,
    rationale:
      args.policy_engine === "merged"
        ? "OPA and rules engine were both consulted and merged."
        : "Single evaluation path; consider enabling OPA merge for higher assurance.",
  });

  const errCount = args.evaluation_errors?.length ?? 0;
  const errorPenalty = clamp01(1 - Math.min(errCount, 3) * 0.12);
  factors.push({
    id: "evaluation_errors",
    weight: 0.15,
    score: errorPenalty,
    rationale:
      errCount === 0 ? "No transport or parse errors during policy evaluation." : `${errCount} evaluation issues reduced confidence.`,
  });

  const reasonDiversity = clamp01(Math.min(args.output.reasonCodes.length, 4) / 4);
  factors.push({
    id: "reason_code_clarity",
    weight: 0.15,
    score: reasonDiversity,
    rationale: "Multiple explicit reason codes improve audit defensibility.",
  });

  let overall = 0;
  let wsum = 0;
  for (const f of factors) {
    overall += f.weight * f.score;
    wsum += f.weight;
  }
  overall = wsum > 0 ? overall / wsum : 0;
  const overall_pct = Math.round(overall * 1000) / 10;

  return { overall, factors, overall_pct };
}
