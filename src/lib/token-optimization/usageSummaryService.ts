import { getSupabaseAdminClient } from "@/lib/supabase";
import type { SecurewatchAgent, UsageSummary } from "@/lib/token-optimization/types";

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getLlmUsageSummary(input: {
  tenantId: string;
  fromDate: string;
  toDate: string;
}): Promise<UsageSummary> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("llm_prompt_logs")
    .select("agent, cache_hit, prompt_tokens, completion_tokens, total_tokens")
    .eq("tenant_id", input.tenantId)
    .gte("created_at", input.fromDate)
    .lte("created_at", input.toDate);

  const rows = data ?? [];
  const totalCalls = rows.length;
  const cacheHits = rows.filter((row) => Boolean(row.cache_hit)).length;
  const totalPromptTokens = rows.reduce((sum, row) => sum + asNumber(row.prompt_tokens), 0);
  const totalCompletionTokens = rows.reduce((sum, row) => sum + asNumber(row.completion_tokens), 0);
  const totalTokens = rows.reduce((sum, row) => sum + asNumber(row.total_tokens), 0);

  const byAgentMap = new Map<
    string,
    { agent: SecurewatchAgent; calls: number; promptTokens: number; completionTokens: number; totalTokens: number }
  >();

  for (const row of rows) {
    const agent = (row.agent as SecurewatchAgent) ?? "monitoring";
    const current = byAgentMap.get(agent) ?? {
      agent,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    current.calls += 1;
    current.promptTokens += asNumber(row.prompt_tokens);
    current.completionTokens += asNumber(row.completion_tokens);
    current.totalTokens += asNumber(row.total_tokens);
    byAgentMap.set(agent, current);
  }

  return {
    tenantId: input.tenantId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    totalCalls,
    cacheHitRate: totalCalls > 0 ? cacheHits / totalCalls : 0,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    estimatedCostUsd: Number(((totalTokens / 1_000_000) * 2).toFixed(6)),
    byAgent: Array.from(byAgentMap.values()),
  };
}
