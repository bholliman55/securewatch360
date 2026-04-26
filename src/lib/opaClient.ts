import type { DecisionAction, DecisionInput, DecisionOutput, DecisionReason } from "@/types/policy";

type OpaEvaluateInput = {
  input: DecisionInput;
  baseUrl?: string;
  policyPath?: string;
  timeoutMs?: number;
};

type OpaPayload = {
  result?: unknown;
  decision?: unknown;
} & Record<string, unknown>;

function coerceReasonCodes(value: unknown): DecisionReason[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .filter((item): item is DecisionReason => item.length > 0);
}

function normalizeOpaDecision(value: unknown): DecisionOutput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.action !== "string") return null;
  if (typeof row.requiresApproval !== "boolean") return null;
  if (typeof row.autoRemediationAllowed !== "boolean") return null;
  if (typeof row.riskAcceptanceAllowed !== "boolean") return null;

  return {
    action: row.action as DecisionAction,
    requiresApproval: row.requiresApproval,
    autoRemediationAllowed: row.autoRemediationAllowed,
    riskAcceptanceAllowed: row.riskAcceptanceAllowed,
    reasonCodes: coerceReasonCodes(row.reasonCodes),
    matchedPolicies: Array.isArray(row.matchedPolicies)
      ? (row.matchedPolicies as Array<{ policyId: string; policyName?: string; version?: string }>)
      : [],
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : undefined,
  };
}

function resolveOpaBaseUrl(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  return (process.env.OPA_BASE_URL ?? "http://localhost:8181").trim();
}

function resolveOpaPolicyPath(): string {
  return (process.env.OPA_POLICY_PATH ?? "/v1/data/securewatch/v4/decision").trim();
}

export async function evaluateDecisionWithOpa(options: OpaEvaluateInput): Promise<DecisionOutput> {
  const baseUrl = resolveOpaBaseUrl(options.baseUrl).replace(/\/$/, "");
  const path = options.policyPath?.trim() || resolveOpaPolicyPath();
  const timeoutMs = options.timeoutMs ?? Number(process.env.OPA_POLICY_EVAL_TIMEOUT_MS ?? "4000");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 4000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: options.input }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`OPA returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as OpaPayload;
    const decision = normalizeOpaDecision(payload.result ?? payload.decision ?? payload);
    if (!decision) {
      throw new Error("OPA response missing valid decision shape");
    }
    return decision;
  } finally {
    clearTimeout(timeoutId);
  }
}
