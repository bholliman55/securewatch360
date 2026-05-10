import type { TaskComplexity } from "./tokenBudget.schema";

export type RoutedCostModel = {
  primary_model: string;
  fallback_low_cost_model: string;
  /** When true, orchestration must obtain human/change approval before calling the primary high-cost model. */
  requires_high_cost_approval: boolean;
  /** Hint for callers under budget pressure. */
  prefer_low_cost: boolean;
};

const MODEL_BY_COMPLEXITY: Record<TaskComplexity, { primary: string; low: string }> = {
  simple: { primary: "sw360:llm:efficient", low: "sw360:llm:nano" },
  medium: { primary: "sw360:llm:primary", low: "sw360:llm:efficient" },
  complex: { primary: "sw360:llm:frontier", low: "sw360:llm:primary" },
};

/**
 * Routes to cheaper models as complexity drops or budgets tighten.
 */
export function routeModelByTaskComplexity(args: {
  complexity: TaskComplexity;
  /** Force cheapest acceptable tier (e.g. tenant near token cap). */
  force_low_cost_tier?: boolean;
  /** Rough USD estimate for this single call — drives approval threshold. */
  estimated_call_usd: number;
  high_cost_usd_approval_threshold: number;
}): RoutedCostModel {
  const tier = args.force_low_cost_tier ? "simple" : args.complexity;
  const pick = MODEL_BY_COMPLEXITY[tier];
  const primary_model = args.force_low_cost_tier ? pick.low : pick.primary;
  const fallback_low_cost_model = pick.low;
  const requires_high_cost_approval =
    args.estimated_call_usd >= args.high_cost_usd_approval_threshold &&
    (args.complexity === "complex" || primary_model.includes("frontier"));
  const prefer_low_cost = Boolean(args.force_low_cost_tier);

  return {
    primary_model,
    fallback_low_cost_model,
    requires_high_cost_approval,
    prefer_low_cost,
  };
}
