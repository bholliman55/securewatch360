import { getSupabaseAdminClient } from "@/lib/supabase";

type PromptLogStartInput = {
  tenantId?: string | null;
  workflowRunId?: string | null;
  agentName: string;
  taskType: string;
  modelProvider: string;
  modelName: string;
  promptHash: string;
  cacheHit?: boolean;
};

type PromptLogUsageInput = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | null;
  cacheHit?: boolean;
};

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  // Practical default approximation, not provider billing truth.
  const total = inputTokens + outputTokens;
  return Number(((total / 1_000_000) * 2).toFixed(6));
}

export async function createPromptLogStart(input: PromptLogStartInput): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("llm_prompt_logs")
    .insert({
      tenant_id: input.tenantId ?? null,
      workflow_run_id: input.workflowRunId ?? null,
      agent_name: input.agentName,
      task_type: input.taskType,
      model_provider: input.modelProvider,
      model_name: input.modelName,
      prompt_hash: input.promptHash,
      cache_hit: input.cacheHit ?? false,
      status: "started",
      error_message: null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    console.warn(`prompt log start failed: ${error?.message ?? "unknown error"}`);
    return null;
  }
  return data.id as string;
}

export async function updatePromptLogSuccess(
  id: string,
  usage: PromptLogUsageInput = {}
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const inputTokens = Number(usage.inputTokens ?? 0);
  const outputTokens = Number(usage.outputTokens ?? 0);
  const estimatedCost =
    usage.estimatedCost === undefined || usage.estimatedCost === null
      ? estimateCostUsd(inputTokens, outputTokens)
      : usage.estimatedCost;

  const { error } = await supabase
    .from("llm_prompt_logs")
    .update({
      cache_hit: usage.cacheHit ?? false,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: estimatedCost,
      status: "success",
      error_message: null,
    })
    .eq("id", id);

  if (error) {
    console.warn(`prompt log success update failed: ${error.message}`);
  }
}

export async function updatePromptLogFailure(id: string, errorInput: unknown): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const message =
    errorInput instanceof Error
      ? errorInput.message
      : typeof errorInput === "string"
        ? errorInput
        : "Unknown LLM gateway failure";

  const { error } = await supabase
    .from("llm_prompt_logs")
    .update({
      status: "error",
      error_message: message.slice(0, 1500),
    })
    .eq("id", id);

  if (error) {
    console.warn(`prompt log failure update failed: ${error.message}`);
  }
}

// Backward-compatible single-call writer.
export async function writePromptLog(input: {
  tenantId: string;
  agent: string;
  taskType: string;
  provider: string;
  model: string;
  promptHash: string;
  cacheHit: boolean;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const id = await createPromptLogStart({
    tenantId: input.tenantId,
    agentName: input.agent,
    taskType: input.taskType,
    modelProvider: input.provider,
    modelName: input.model,
    promptHash: input.promptHash,
    cacheHit: input.cacheHit,
  });
  if (!id) return;
  await updatePromptLogSuccess(id, {
    cacheHit: input.cacheHit,
    inputTokens: input.promptTokens,
    outputTokens: input.completionTokens,
  });
}
