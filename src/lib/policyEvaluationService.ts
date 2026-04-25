import { getSupabaseAdminClient } from "@/lib/supabase";
import { mergePolicyOutputs } from "@/lib/policyPrecedence";
import type { DecisionAction, DecisionInput, DecisionOutput, DecisionReason, Policy } from "@/types/policy";

export type ActivePolicy = Pick<
  Policy,
  "id" | "tenant_id" | "name" | "policy_type" | "framework" | "rego_code" | "version" | "is_active"
>;

export type PolicyEvaluationResult = {
  decision: DecisionOutput;
  fallbackDecision: DecisionOutput;
  opaDecision: DecisionOutput | null;
  engine: "fallback" | "opa" | "merged";
  matchedPolicyCount: number;
  errors: string[];
};

type EvaluatePolicyInput = {
  input: DecisionInput;
  fallbackEvaluator: (input: DecisionInput) => Promise<DecisionOutput>;
  endpointUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  activePolicies?: ActivePolicy[];
};

type OpaCompatibleResponse = {
  result?: unknown;
  decision?: unknown;
} & Record<string, unknown>;

function coerceReasonCodes(value: unknown): DecisionReason[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .filter((item): item is DecisionReason => item.length > 0);
}

function coerceMatchedPolicies(
  value: unknown
): Array<{ policyId: string; policyName?: string; version?: string }> {
  if (!Array.isArray(value)) return [];
  const items: Array<{ policyId: string; policyName?: string; version?: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const policyId = typeof row.policyId === "string" ? row.policyId : "";
    if (!policyId) continue;
    items.push({
      policyId,
      policyName: typeof row.policyName === "string" ? row.policyName : undefined,
      version: typeof row.version === "string" ? row.version : undefined,
    });
  }
  return items;
}

function defaultDecisionOutput(): DecisionOutput {
  return {
    action: "allow",
    requiresApproval: false,
    autoRemediationAllowed: false,
    riskAcceptanceAllowed: true,
    reasonCodes: ["policy_not_matched"],
    matchedPolicies: [],
    metadata: {},
  };
}

function toDecisionOutput(value: unknown): DecisionOutput | null {
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
    matchedPolicies: coerceMatchedPolicies(row.matchedPolicies),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : undefined,
  };
}

function resolveEndpointUrl(explicitUrl?: string): string | null {
  if (explicitUrl && explicitUrl.trim()) return explicitUrl.trim();
  const envUrl = process.env.OPA_POLICY_EVAL_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim();
  return null;
}

/** When true and `OPA_POLICY_EVAL_URL` is set, transport/HTTP/decision-parse failures return a non-permissive decision (see README). */
function isOpaFailOnEndpointErrorEnabled(): boolean {
  const v = process.env.OPA_FAIL_ON_ENDPOINT_ERROR?.trim().toLowerCase();
  return v === "true" || v === "1";
}

function buildOpaUnavailableMetadata(
  fallbackDecision: DecisionOutput,
  message: string
): Record<string, unknown> {
  return {
    ...(fallbackDecision.metadata ?? {}),
    sw360_opa_unavailable: true,
    sw360_opa_endpoint_error: true,
    sw360_opa_error_message: message,
  };
}

/**
 * OPA was configured but the endpoint did not return a usable decision.
 * Default: same as today (fallback rules decision + availability metadata).
 * `OPA_FAIL_ON_ENDPOINT_ERROR=true`: fail-closed — `escalate` + requiresApproval (see README).
 */
function decisionWhenOpaUnavailable(
  fallbackDecision: DecisionOutput,
  errorMessage: string
): DecisionOutput {
  const metadata = buildOpaUnavailableMetadata(fallbackDecision, errorMessage);
  if (!isOpaFailOnEndpointErrorEnabled()) {
    return {
      ...fallbackDecision,
      metadata,
    };
  }
  return {
    ...fallbackDecision,
    action: "escalate",
    requiresApproval: true,
    autoRemediationAllowed: false,
    riskAcceptanceAllowed: false,
    reasonCodes: ["opa_endpoint_unavailable"],
    metadata: {
      ...metadata,
      sw360_opa_fail_closed: true,
    },
  };
}

async function callOpaCompatibleEndpoint(options: {
  endpointUrl: string;
  authToken?: string;
  timeoutMs: number;
  input: DecisionInput;
  policies: ActivePolicy[];
}): Promise<DecisionOutput | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(options.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      },
      body: JSON.stringify({
        input: options.input,
        policies: options.policies.map((policy) => ({
          id: policy.id,
          name: policy.name,
          policyType: policy.policy_type,
          framework: policy.framework,
          rego: policy.rego_code,
          version: policy.version,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OPA endpoint returned ${response.status}`);
    }

    const payload = (await response.json()) as OpaCompatibleResponse;
    const decision = toDecisionOutput(payload.decision ?? payload.result ?? payload);
    return decision;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function loadActivePolicies(tenantId: string): Promise<ActivePolicy[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("policies")
    .select("id, tenant_id, name, policy_type, framework, rego_code, version, is_active")
    .eq("is_active", true)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("tenant_id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load active policies: ${error.message}`);
  }

  return (data ?? []) as ActivePolicy[];
}

export async function evaluateAgainstPolicies(
  options: EvaluatePolicyInput
): Promise<PolicyEvaluationResult> {
  const fallbackDecision = await options.fallbackEvaluator(options.input);
  const endpointUrl = resolveEndpointUrl(options.endpointUrl);
  const timeoutMs = options.timeoutMs ?? Number(process.env.OPA_POLICY_EVAL_TIMEOUT_MS ?? "4000");
  const authToken = options.authToken ?? process.env.OPA_POLICY_EVAL_TOKEN;
  const errors: string[] = [];

  const activePolicies =
    options.activePolicies ??
    (options.input.tenantId ? await loadActivePolicies(options.input.tenantId) : []);

  if (!endpointUrl) {
    return {
      decision: fallbackDecision,
      fallbackDecision,
      opaDecision: null,
      engine: "fallback",
      matchedPolicyCount: activePolicies.length,
      errors,
    };
  }

  try {
    const opaDecision = await callOpaCompatibleEndpoint({
      endpointUrl,
      authToken,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 4000,
      input: options.input,
      policies: activePolicies,
    });

    if (!opaDecision) {
      const message = "OPA response did not contain a valid decision";
      errors.push(message);
      return {
        decision: decisionWhenOpaUnavailable(fallbackDecision, message),
        fallbackDecision,
        opaDecision: null,
        engine: "fallback",
        matchedPolicyCount: activePolicies.length,
        errors,
      };
    }

    const mergedDecision = mergePolicyOutputs([
      { source: "fallback-rules", decision: fallbackDecision },
      { source: "opa-endpoint", decision: opaDecision },
    ]);
    return {
      decision: mergedDecision,
      fallbackDecision,
      opaDecision,
      engine: "merged",
      matchedPolicyCount: activePolicies.length,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OPA evaluation failed";
    errors.push(message);
    return {
      decision: decisionWhenOpaUnavailable(fallbackDecision, message),
      fallbackDecision,
      opaDecision: null,
      engine: "fallback",
      matchedPolicyCount: activePolicies.length,
      errors,
    };
  }
}

// Convenience entrypoint when callers only need the merged/fallback decision.
export async function evaluatePolicyDecision(
  input: DecisionInput,
  fallbackEvaluator: (input: DecisionInput) => Promise<DecisionOutput>
): Promise<DecisionOutput> {
  const result = await evaluateAgainstPolicies({
    input,
    fallbackEvaluator,
  });
  return result.decision;
}
