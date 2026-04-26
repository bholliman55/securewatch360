import { getSupabaseAdminClient } from "@/lib/supabase";
import type { AgentName, CacheLookupResult, LLMTaskType } from "@/lib/token-optimization/types";
import { hashPrompt } from "@/lib/token-optimization/promptHash";

const CACHEABLE_TASK_TYPES = new Set<string>([
  "remediation_recommendation_wording",
  "evidence_summary",
  "control_gap_explanation",
  "auditor_wording",
  "monitoring_summary",
  "risk_explanation",
]);

const NON_CACHEABLE_TASK_HINTS = [/active[_-]?exploit/i, /containment/i, /live[_-]?response/i];
const SENSITIVE_PATTERNS = [
  /bearer\s+[a-z0-9\-._~+/]+=*/i,
  /\b(api[-_ ]?key|token|password|secret)\b/i,
  /\bcookie\b/i,
  /https?:\/\/[^\s]*webhook[^\s]*/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
];

function hasSecrets(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? {});
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function buildStoragePromptHash(promptHash: string, inputFingerprint: string): string {
  return hashPrompt({ promptHash, inputFingerprint });
}

export function shouldUseCache(taskType: LLMTaskType | string, agentName: AgentName | string): boolean {
  if (NON_CACHEABLE_TASK_HINTS.some((pattern) => pattern.test(taskType))) return false;
  if (agentName === "monitoring" && /incident[_-]?investigation/i.test(taskType)) return false;
  return CACHEABLE_TASK_TYPES.has(taskType);
}

export async function getCachedResponse(input: {
  tenantId?: string | null;
  agentName: AgentName | string;
  taskType: LLMTaskType | string;
  promptHash: string;
  inputFingerprint: string;
  allowGlobalFallback?: boolean;
}): Promise<
  CacheLookupResult & {
    source: "tenant" | "global" | "none";
    reason?: string;
  }
> {
  if (!shouldUseCache(input.taskType, input.agentName)) {
    return { hit: false, cacheKey: `${input.promptHash}:${input.inputFingerprint}`, source: "none", reason: "task_not_cacheable" };
  }

  const supabase = getSupabaseAdminClient();
  const storagePromptHash = buildStoragePromptHash(input.promptHash, input.inputFingerprint);
  const baseQuery = supabase
    .from("llm_response_cache")
    .select("response_payload, expires_at")
    .eq("agent_name", input.agentName)
    .eq("task_type", input.taskType)
    .eq("prompt_hash", storagePromptHash)
    .eq("input_fingerprint", input.inputFingerprint);

  try {
    const tenantRow = input.tenantId
      ? await baseQuery.eq("tenant_id", input.tenantId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };

    const globalRow =
      !tenantRow.data && input.allowGlobalFallback !== false
        ? await baseQuery.is("tenant_id", null).order("updated_at", { ascending: false }).limit(1).maybeSingle()
        : { data: null };

    const row = tenantRow.data ?? globalRow.data;
    const source: "tenant" | "global" | "none" = tenantRow.data ? "tenant" : globalRow.data ? "global" : "none";

    if (!row) return { hit: false, cacheKey: `${input.promptHash}:${input.inputFingerprint}`, source };
    const expiresAt = row.expires_at ? Date.parse(row.expires_at as string) : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      return { hit: false, cacheKey: `${input.promptHash}:${input.inputFingerprint}`, source, reason: "expired" };
    }

    const payload = (row.response_payload ?? {}) as Record<string, unknown>;
    const responseText = typeof payload.responseText === "string" ? payload.responseText : undefined;
    return {
      hit: true,
      source,
      cacheKey: `${input.promptHash}:${input.inputFingerprint}`,
      responseText,
      responsePayload: payload,
      tokenUsage: {
        promptTokens: Number(payload.promptTokens ?? 0),
        completionTokens: Number(payload.completionTokens ?? 0),
        totalTokens: Number(payload.totalTokens ?? 0),
      },
    };
  } catch (error) {
    return {
      hit: false,
      source: "none",
      cacheKey: `${input.promptHash}:${input.inputFingerprint}`,
      reason: error instanceof Error ? error.message : "cache_read_failed",
    };
  }
}

export async function writeCachedResponse(input: {
  tenantId?: string | null;
  agentName: AgentName | string;
  taskType: LLMTaskType | string;
  promptHash: string;
  inputFingerprint?: string;
  responsePayload?: Record<string, unknown>;
  responseText: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  ttlSeconds?: number;
  disableCache?: boolean;
  allowGlobalWrite?: boolean;
  rawInputForSafety?: unknown;
}): Promise<void> {
  if (input.disableCache) return;
  if (!shouldUseCache(input.taskType, input.agentName)) return;
  if (hasSecrets(input.rawInputForSafety)) return;

  const supabase = getSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 60 * 60 * 24) * 1000).toISOString();
  const inputFingerprint = input.inputFingerprint ?? hashPrompt({ responseText: input.responseText.slice(0, 500) });
  const storagePromptHash = buildStoragePromptHash(input.promptHash, inputFingerprint);
  const tenantId = input.allowGlobalWrite ? null : (input.tenantId ?? null);
  const responsePayload = input.responsePayload ?? {
    responseText: input.responseText,
    promptTokens: input.promptTokens ?? 0,
    completionTokens: input.completionTokens ?? 0,
    totalTokens: input.totalTokens ?? 0,
  };

  try {
    const { error } = await supabase.from("llm_response_cache").upsert(
      {
        tenant_id: tenantId,
        agent_name: input.agentName,
        task_type: input.taskType,
        prompt_hash: storagePromptHash,
        input_fingerprint: inputFingerprint,
        response_payload: responsePayload,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "tenant_id,agent_name,task_type,prompt_hash",
      }
    );
    if (error) {
      // Non-fatal for runtime flows; caller should continue without cache.
      console.warn(`llm cache write skipped: ${error.message}`);
    }
  } catch (error) {
    console.warn(`llm cache write failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

// Backward-compatible wrapper
export async function readCachedResponse(input: {
  tenantId: string;
  agent: string;
  taskType: string;
  promptHash: string;
}): Promise<{
  hit: boolean;
  responseText?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}> {
  const result = await getCachedResponse({
    tenantId: input.tenantId,
    agentName: input.agent,
    taskType: input.taskType,
    promptHash: input.promptHash,
    inputFingerprint: "legacy",
  });
  return {
    hit: result.hit,
    responseText: result.responseText,
    promptTokens: result.tokenUsage?.promptTokens,
    completionTokens: result.tokenUsage?.completionTokens,
    totalTokens: result.tokenUsage?.totalTokens,
  };
}
