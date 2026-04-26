/** Shared agent identifiers used by all SecureWatch360 agent families. */
export const AGENT_NAMES = [
  "scanner",
  "vulnerability",
  "compliance",
  "remediation",
  "monitoring",
] as const;

/** Agent name enum-like union for provider-agnostic token services. */
export type AgentName = (typeof AGENT_NAMES)[number];

/** Allowed LLM task intents across all agents. */
export const LLM_TASK_TYPES = [
  "risk_explanation",
  "evidence_summary",
  "control_gap_explanation",
  "auditor_wording",
  "remediation_recommendation_wording",
  "monitoring_summary",
  "incident_summary",
] as const;

/** Task type union used for budgets, logging, cache, and gateway calls. */
export type LLMTaskType = (typeof LLM_TASK_TYPES)[number];

/** One context entry for a prompt payload, keeps structure simple and reusable. */
export interface ContextItem {
  key: string;
  value: unknown;
  sensitivity?: "low" | "moderate" | "high";
}

/** Agent context payload sent to the optimization gateway before prompt build. */
export interface ContextBundle {
  agentName?: AgentName;
  taskType?: LLMTaskType | string;
  tenantId: string;
  findingId?: string;
  scanRunId?: string;
  incidentId?: string;
  alertId?: string;
  policyDecisionId?: string;
  evidenceRecordIds?: string[];
  items?: ContextItem[];
  metadata?: Record<string, unknown>;
  data: Record<string, unknown>;
}

/** Reusable summary object for compressed context reuse. */
export interface ContextSummary {
  tenantId?: string | null;
  entityType: string;
  entityId: string;
  summaryType: string;
  summaryText: string;
  sourceHash: string;
  tokenEstimate?: number | null;
  expiresAt?: string | null;
}

/** Budget rule consumed by gateway before provider calls. */
export interface PromptBudget {
  tenantId?: string | null;
  agent: AgentName;
  taskType: LLMTaskType;
  maxPromptTokens: number;
  maxCompletionTokens: number;
  maxTotalTokens: number;
  maxEstimatedCost?: number | null;
  fallbackStrategy?:
    | "trim_context"
    | "summarize_context"
    | "reject"
    | "compress"
    | "summary_only"
    | "high_severity_only"
    | "reject_with_error";
  isActive?: boolean;
}

/** Lightweight estimate used when provider token metrics are unavailable. */
export interface TokenEstimate {
  characters: number;
  estimatedTokens: number;
}

/** Immutable prompt log shape for telemetry and usage summaries. */
export interface PromptLog {
  id?: string;
  tenantId?: string | null;
  workflowRunId?: string | null;
  agentName: AgentName;
  taskType: LLMTaskType;
  modelProvider: string;
  modelName: string;
  promptHash: string;
  cacheHit: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | null;
  status: "success" | "error" | "cached";
  errorMessage?: string | null;
  createdAt?: string;
}

/** Cache read result for an optimized prompt. */
export interface CacheLookupResult {
  hit: boolean;
  cacheKey: string;
  responseText?: string;
  responsePayload?: Record<string, unknown>;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Cache write input used by cache service after provider completion. */
export interface CacheWriteInput {
  tenantId?: string | null;
  agentName: AgentName;
  taskType: LLMTaskType;
  promptHash: string;
  inputFingerprint: string;
  responsePayload: Record<string, unknown>;
  responseText: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  expiresAt?: string | null;
}

/** Gateway request used by all agents; provider remains abstracted. */
export interface OptimizedPromptRequest {
  tenantId: string;
  agent: AgentName;
  taskType: LLMTaskType;
  model: string;
  instruction: string;
  contextBundle: ContextBundle;
  maxCompletionTokens?: number;
  temperature?: number;
  allowCache?: boolean;
  allowSummaryReuse?: boolean;
  includePromptPreviewInLogs?: boolean;
}

/** Gateway response with cache + token metadata for observability. */
export interface OptimizedPromptResult {
  /** Primary response payload for callers. */
  response: string;
  /** Shortcut boolean for cache usage. */
  cacheHit: boolean;
  /** Prompt log id for traceability in llm_prompt_logs. */
  promptLogId?: string | null;
  /** Non-fatal warnings collected during optimization/budgeting. */
  warnings: string[];
  /** Estimation snapshot (budgeting-oriented, not billing-accurate). */
  tokenEstimate: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  // Backward-compatible fields
  provider: string;
  model: string;
  responseText: string;
  cache: CacheLookupResult;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedPromptTokens: number;
  };
  compression: {
    wasCompressed: boolean;
    originalChars: number;
    compressedChars: number;
  };
  promptHash: string;
  fromSummary: boolean;
}

export type ProviderGenerateRequest = {
  model: string;
  prompt: string;
  maxCompletionTokens: number;
  temperature: number;
};

export type ProviderGenerateResult = {
  provider: string;
  model: string;
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export type UsageSummary = {
  tenantId: string;
  fromDate: string;
  toDate: string;
  totalCalls: number;
  cacheHitRate: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  byAgent: Array<{
    agent: SecurewatchAgent;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
};

// Backward-compatible aliases for existing module imports.
export const SECUREWATCH_AGENTS = AGENT_NAMES;
export type SecurewatchAgent = AgentName;
export const AGENT_TASK_TYPES = LLM_TASK_TYPES;
export type AgentTaskType = LLMTaskType;
export type CacheResult = CacheLookupResult;
