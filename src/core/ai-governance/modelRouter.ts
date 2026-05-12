import type { AiModelRouting, AiTaskKind } from "./aiDecision.schema";
import { aiModelRoutingSchema } from "./aiDecision.schema";

export type ModelRoutingInput = {
  task_kind: AiTaskKind;
  /** When true, skip probabilistic models — use deterministic / rules-first slugs. */
  deterministic: boolean;
  tenant_prefers_budget_model?: boolean;
};

const DEFAULT_PRIMARY = "sw360:llm:primary";
const DEFAULT_FALLBACK = "sw360:llm:fallback";
const DETERMINISTIC_PRIMARY = "sw360:deterministic:rules+nlg-template";
const BUDGET_PRIMARY = "sw360:llm:efficient";

/**
 * Selects primary and optional fallback model slugs — wire to provider SDKs via tenant config, not hardcoded keys.
 */
export function routeModels(input: ModelRoutingInput): AiModelRouting {
  if (input.deterministic) {
    return aiModelRoutingSchema.parse({
      primary_model: DETERMINISTIC_PRIMARY,
      fallback_model: undefined,
      deterministic: true,
    });
  }

  let primary = DEFAULT_PRIMARY;
  if (input.tenant_prefers_budget_model) {
    primary = BUDGET_PRIMARY;
  }

  if (input.task_kind === "action_recommendation") {
    primary = input.tenant_prefers_budget_model ? BUDGET_PRIMARY : DEFAULT_PRIMARY;
  }

  return aiModelRoutingSchema.parse({
    primary_model: primary,
    fallback_model: DEFAULT_FALLBACK,
    deterministic: false,
  });
}

/**
 * When confidence is below threshold, caller may retry with `routing.fallback_model`.
 */
export function shouldUseFallbackModel(args: {
  confidence_0_1: number;
  threshold: number;
  routing: AiModelRouting;
}): boolean {
  return (
    args.confidence_0_1 < args.threshold &&
    Boolean(args.routing.fallback_model) &&
    !args.routing.deterministic
  );
}
