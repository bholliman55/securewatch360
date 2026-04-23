import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { DECISION_RESULTS, type DecisionResult } from "@/types/policy";

type PolicyDecisionRow = {
  id: string;
  tenant_id: string;
  finding_id: string | null;
  remediation_action_id: string | null;
  policy_id: string | null;
  decision_type: string;
  decision_result: string;
  reason: string | null;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  created_at: string;
  policy: { name?: string | null; version?: string | null } | { name?: string | null; version?: string | null }[] | null;
  finding: { title?: string | null } | { title?: string | null }[] | null;
  remediation: { action_type?: string | null } | { action_type?: string | null }[] | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function firstObject<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function extractMatchedPolicyNames(
  outputPayload: Record<string, unknown>,
  fallbackPolicyName: string | null
): string[] {
  const raw = outputPayload.matchedPolicies;
  const fromPayload =
    Array.isArray(raw)
      ? raw
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const name = (entry as { policyName?: unknown }).policyName;
            return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
          })
          .filter((name): name is string => Boolean(name))
      : [];

  if (fromPayload.length > 0) {
    return [...new Set(fromPayload)];
  }
  return fallbackPolicyName ? [fallbackPolicyName] : [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const decisionResult = searchParams.get("decisionResult")?.trim().toLowerCase() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 100;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (decisionResult && !DECISION_RESULTS.includes(decisionResult as DecisionResult)) {
      return NextResponse.json(
        { ok: false, error: `decisionResult must be one of: ${DECISION_RESULTS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return NextResponse.json(
        { ok: false, error: "limit must be an integer between 1 and 500" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("policy_decisions")
      .select(
        "id, tenant_id, finding_id, remediation_action_id, policy_id, decision_type, decision_result, reason, input_payload, output_payload, created_at, policy:policies(name, version), finding:findings(title), remediation:remediation_actions(action_type)"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (decisionResult) {
      query = query.eq("decision_result", decisionResult);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const decisions = ((data ?? []) as unknown as PolicyDecisionRow[]).map((row) => {
      const policy = firstObject(row.policy);
      const finding = firstObject(row.finding);
      const remediation = firstObject(row.remediation);
      const outputPayload = row.output_payload ?? {};
      const matchedPolicyNames = extractMatchedPolicyNames(outputPayload, policy?.name ?? null);

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        finding_id: row.finding_id,
        finding_title: finding?.title ?? null,
        remediation_action_id: row.remediation_action_id,
        remediation_action_type: remediation?.action_type ?? null,
        policy_id: row.policy_id,
        policy_name: policy?.name ?? null,
        policy_version: policy?.version ?? null,
        decision_type: row.decision_type,
        decision_result: row.decision_result,
        reason: row.reason,
        matched_policy_names: matchedPolicyNames,
        output_payload: outputPayload,
        created_at: row.created_at,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        policyDecisions: decisions,
        count: decisions.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load policy decisions", message },
      { status: 500 }
    );
  }
}
