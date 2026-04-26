import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  compressContextBundle,
  type CompressionStrategy,
} from "@/lib/token-optimization/contextCompressor";
import { estimateContextBundleTokens, estimateTokens } from "@/lib/token-optimization/tokenEstimator";
import type { AgentName, ContextBundle, LLMTaskType, PromptBudget } from "@/lib/token-optimization/types";

type FallbackStrategy = "compress" | "summary_only" | "high_severity_only" | "reject_with_error";

const AGENT_DEFAULT_BUDGETS: Record<
  AgentName,
  {
    maxPromptTokens: number;
    maxCompletionTokens: number;
    maxTotalTokens: number;
    fallbackStrategy: FallbackStrategy;
  }
> = {
  scanner: {
    maxPromptTokens: 1800,
    maxCompletionTokens: 220,
    maxTotalTokens: 2200,
    fallbackStrategy: "summary_only",
  },
  vulnerability: {
    maxPromptTokens: 2600,
    maxCompletionTokens: 350,
    maxTotalTokens: 3200,
    fallbackStrategy: "high_severity_only",
  },
  compliance: {
    maxPromptTokens: 2400,
    maxCompletionTokens: 320,
    maxTotalTokens: 2900,
    fallbackStrategy: "summary_only",
  },
  remediation: {
    maxPromptTokens: 2200,
    maxCompletionTokens: 280,
    maxTotalTokens: 2700,
    fallbackStrategy: "compress",
  },
  monitoring: {
    maxPromptTokens: 1600,
    maxCompletionTokens: 220,
    maxTotalTokens: 2000,
    fallbackStrategy: "compress",
  },
};

function buildDefaultBudget(
  tenantId: string,
  agentName: AgentName,
  taskType: LLMTaskType
): PromptBudget {
  const defaults = AGENT_DEFAULT_BUDGETS[agentName];
  return {
    tenantId,
    agent: agentName,
    taskType,
    maxPromptTokens: defaults.maxPromptTokens,
    maxCompletionTokens: defaults.maxCompletionTokens,
    maxTotalTokens: defaults.maxTotalTokens,
    fallbackStrategy: defaults.fallbackStrategy,
    isActive: true,
  };
}

export async function getPromptBudget(
  tenantIdOrInput:
    | string
    | {
        tenantId: string;
        agent: AgentName;
        taskType: LLMTaskType;
      },
  agentNameArg?: AgentName,
  taskTypeArg?: LLMTaskType
): Promise<PromptBudget> {
  const tenantId = typeof tenantIdOrInput === "string" ? tenantIdOrInput : tenantIdOrInput.tenantId;
  const agentName = typeof tenantIdOrInput === "string" ? (agentNameArg as AgentName) : tenantIdOrInput.agent;
  const taskType = typeof tenantIdOrInput === "string" ? (taskTypeArg as LLMTaskType) : tenantIdOrInput.taskType;

  const fallbackBudget = buildDefaultBudget(tenantId, agentName, taskType);
  const supabase = getSupabaseAdminClient();

  const { data } = await supabase
    .from("token_budgets")
    .select(
      "max_input_tokens, max_output_tokens, max_estimated_cost, fallback_strategy, is_active, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("agent_name", agentName)
    .eq("task_type", taskType)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return fallbackBudget;

  return {
    tenantId,
    agent: agentName,
    taskType,
    maxPromptTokens: Number(data.max_input_tokens ?? fallbackBudget.maxPromptTokens),
    maxCompletionTokens: Number(data.max_output_tokens ?? fallbackBudget.maxCompletionTokens),
    maxTotalTokens: Number(
      Number(data.max_input_tokens ?? fallbackBudget.maxPromptTokens) +
        Number(data.max_output_tokens ?? fallbackBudget.maxCompletionTokens)
    ),
    maxEstimatedCost: Number(data.max_estimated_cost ?? 0) || null,
    fallbackStrategy: (data.fallback_strategy as FallbackStrategy | null) ?? fallbackBudget.fallbackStrategy,
    isActive: Boolean(data.is_active),
  };
}

type EnforcePromptBudgetRequest = {
  tenantId: string;
  agentName: AgentName;
  taskType: LLMTaskType;
  instruction: string;
  contextBundle: ContextBundle;
};

type EnforcePromptBudgetResult = {
  budget: PromptBudget;
  adjustedContextBundle: ContextBundle;
  estimatedPromptTokens: number;
  exceededBeforeFallback: boolean;
  appliedFallback: FallbackStrategy | "none";
  warnings: string[];
  rejected: boolean;
  rejectReason?: string;
};

function mapFallbackToStrategies(fallback: FallbackStrategy): CompressionStrategy[] {
  if (fallback === "summary_only") return ["summarize_repeated_findings", "evidence_summary_only"];
  if (fallback === "high_severity_only")
    return ["keep_high_severity_first", "drop_low_signal_fields", "summarize_repeated_findings"];
  return ["drop_low_signal_fields", "summarize_repeated_findings"];
}

function normalizeFallbackStrategy(value: PromptBudget["fallbackStrategy"]): FallbackStrategy {
  if (value === "compress" || value === "summary_only" || value === "high_severity_only") return value;
  if (value === "reject_with_error" || value === "reject") return "reject_with_error";
  if (value === "summarize_context") return "summary_only";
  return "compress";
}

export async function enforcePromptBudget(
  request: EnforcePromptBudgetRequest
): Promise<EnforcePromptBudgetResult> {
  const budget = await getPromptBudget(request.tenantId, request.agentName, request.taskType);
  const instructionTokens = estimateTokens(request.instruction);
  const contextTokens = estimateContextBundleTokens(request.contextBundle);
  const estimatedPromptTokens = instructionTokens + contextTokens;
  const exceededBeforeFallback = estimatedPromptTokens > budget.maxPromptTokens;

  if (!exceededBeforeFallback) {
    return {
      budget,
      adjustedContextBundle: request.contextBundle,
      estimatedPromptTokens,
      exceededBeforeFallback: false,
      appliedFallback: "none",
      warnings: [],
      rejected: false,
    };
  }

  const fallback = normalizeFallbackStrategy(budget.fallbackStrategy);
  if (fallback === "reject_with_error") {
    return {
      budget,
      adjustedContextBundle: request.contextBundle,
      estimatedPromptTokens,
      exceededBeforeFallback: true,
      appliedFallback: "reject_with_error",
      warnings: [`Budget exceeded (${estimatedPromptTokens} > ${budget.maxPromptTokens}).`],
      rejected: true,
      rejectReason: "Prompt exceeds budget and fallback strategy is reject_with_error.",
    };
  }

  const compression = compressContextBundle(request.contextBundle, {
    agentName: request.agentName,
    maxTokens: Math.max(1, budget.maxPromptTokens - instructionTokens),
    strategies: mapFallbackToStrategies(fallback),
  });
  const adjustedPromptTokens = instructionTokens + compression.estimatedTokensAfter;

  return {
    budget,
    adjustedContextBundle: compression.compressedBundle,
    estimatedPromptTokens: adjustedPromptTokens,
    exceededBeforeFallback: true,
    appliedFallback: fallback,
    warnings: compression.warnings,
    rejected: adjustedPromptTokens > budget.maxPromptTokens,
    rejectReason:
      adjustedPromptTokens > budget.maxPromptTokens
        ? "Prompt still exceeds token budget after fallback compression."
        : undefined,
  };
}
