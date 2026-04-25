import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { writeAuditLog } from "@/lib/audit";

const EXPORT_VERSION = 1;
const MAX_RANGE_DAYS = 366;
const POLICY_DECISIONS_SAMPLE_LIMIT = 500;
const RISK_EXCEPTIONS_MAX = 2000;
const APPROVAL_REQUESTS_MAX = 2000;
const AUDIT_LOGS_MAX = 5000;

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

type ParsedExportInput = { tenantId: string; start: Date; end: Date };

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
  const fromPayload = Array.isArray(raw)
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

function parseIsoDate(label: string, raw: string | null): { ok: true; d: Date } | { ok: false; error: string } {
  if (!raw || !raw.trim()) {
    return { ok: false, error: `${label} is required` };
  }
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `${label} must be a valid ISO-8601 datetime` };
  }
  return { ok: true, d };
}

function parseRangeDays(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function getExportInputFromSearchParams(searchParams: URLSearchParams): ParsedExportInput | { error: string } {
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const startRaw = searchParams.get("start")?.trim() ?? searchParams.get("startAt")?.trim() ?? "";
  const endRaw = searchParams.get("end")?.trim() ?? searchParams.get("endAt")?.trim() ?? "";

  if (!tenantId || !isUuid(tenantId)) {
    return { error: "tenantId must be a valid UUID" };
  }

  const s = parseIsoDate("start", startRaw);
  if (!s.ok) return { error: s.error };
  const e = parseIsoDate("end", endRaw);
  if (!e.ok) return { error: e.error };
  if (e.d.getTime() < s.d.getTime()) {
    return { error: "end must be on or after start" };
  }
  if (parseRangeDays(s.d, e.d) > MAX_RANGE_DAYS) {
    return { error: `date range must be at most ${MAX_RANGE_DAYS} days` };
  }

  return { tenantId, start: s.d, end: e.d };
}

type Body = {
  tenantId?: unknown;
  start?: unknown;
  end?: unknown;
  startAt?: unknown;
  endAt?: unknown;
};

function getExportInputFromBody(body: Body): ParsedExportInput | { error: string } {
  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const startRaw =
    typeof body.start === "string" ? body.start : typeof body.startAt === "string" ? body.startAt : "";
  const endRaw = typeof body.end === "string" ? body.end : typeof body.endAt === "string" ? body.endAt : "";

  if (!tenantId || !isUuid(tenantId)) {
    return { error: "tenantId must be a valid UUID" };
  }

  const s = parseIsoDate("start", startRaw || null);
  if (!s.ok) return { error: s.error };
  const e = parseIsoDate("end", endRaw || null);
  if (!e.ok) return { error: e.error };
  if (e.d.getTime() < s.d.getTime()) {
    return { error: "end must be on or after start" };
  }
  if (parseRangeDays(s.d, e.d) > MAX_RANGE_DAYS) {
    return { error: `date range must be at most ${MAX_RANGE_DAYS} days` };
  }

  return { tenantId, start: s.d, end: e.d };
}

function toIsoParam(d: Date): string {
  return d.toISOString();
}

async function runExport(
  request: Request,
  input: ParsedExportInput,
  guard: { userId: string; role: string }
) {
  const { tenantId, start, end } = input;
  const startIso = toIsoParam(start);
  const endIso = toIsoParam(end);

  const supabase = getSupabaseAdminClient();
  const exportId = crypto.randomUUID();

  const [policyRes, riskRes, approvalRes, auditRes] = await Promise.all([
    supabase
      .from("policy_decisions")
      .select(
        "id, tenant_id, finding_id, remediation_action_id, policy_id, decision_type, decision_result, reason, input_payload, output_payload, created_at, policy:policies(name, version), finding:findings(title), remediation:remediation_actions(action_type)"
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(POLICY_DECISIONS_SAMPLE_LIMIT),
    supabase
      .from("risk_exceptions")
      .select(
        "id, tenant_id, finding_id, requested_by_user_id, approved_by_user_id, status, justification, expires_at, created_at, updated_at, review_sla_due_at, sla_breached_at, escalation_level"
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(RISK_EXCEPTIONS_MAX),
    supabase
      .from("approval_requests")
      .select(
        "id, tenant_id, finding_id, remediation_action_id, requested_by_user_id, assigned_approver_user_id, approval_type, status, reason, request_payload, response_payload, created_at, updated_at, resolved_at, sla_due_at, sla_first_reminder_at, sla_breached_at, escalation_level"
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(APPROVAL_REQUESTS_MAX),
    supabase
      .from("audit_logs")
      .select("id, user_id, tenant_id, entity_type, entity_id, action, summary, payload, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(AUDIT_LOGS_MAX),
  ]);

  if (policyRes.error) throw new Error(policyRes.error.message);
  if (riskRes.error) throw new Error(riskRes.error.message);
  if (approvalRes.error) throw new Error(approvalRes.error.message);
  if (auditRes.error) throw new Error(auditRes.error.message);

  const policyRows = (policyRes.data ?? []) as unknown as PolicyDecisionRow[];
  const policyDecisions = policyRows.map((row) => {
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
      input_payload: row.input_payload ?? {},
      output_payload: outputPayload,
      created_at: row.created_at,
    };
  });

  const riskExceptions = riskRes.data ?? [];
  const approvalRequests = approvalRes.data ?? [];
  const auditLogs = auditRes.data ?? [];

  const payload = {
    ok: true as const,
    export: {
      version: EXPORT_VERSION,
      id: exportId,
      kind: "auditor_evidence_pack" as const,
      generatedAt: new Date().toISOString(),
      requestPath: new URL(request.url).pathname,
      tenantId,
      range: { start: startIso, end: endIso },
      requestedBy: { userId: guard.userId, role: guard.role },
      limits: {
        policyDecisionsSample: POLICY_DECISIONS_SAMPLE_LIMIT,
        riskExceptions: RISK_EXCEPTIONS_MAX,
        approvalRequests: APPROVAL_REQUESTS_MAX,
        auditLogs: AUDIT_LOGS_MAX,
      },
      truncated: {
        policyDecisions: policyDecisions.length >= POLICY_DECISIONS_SAMPLE_LIMIT,
        riskExceptions: riskExceptions.length >= RISK_EXCEPTIONS_MAX,
        approvalRequests: approvalRequests.length >= APPROVAL_REQUESTS_MAX,
        auditLogs: auditLogs.length >= AUDIT_LOGS_MAX,
      },
      counts: {
        policyDecisions: policyDecisions.length,
        riskExceptions: riskExceptions.length,
        approvalRequests: approvalRequests.length,
        auditLogs: auditLogs.length,
      },
    },
    policyDecisions,
    riskExceptions,
    approvalRequests,
    auditLogs,
  };

  await writeAuditLog({
    userId: guard.userId,
    tenantId,
    entityType: "system",
    entityId: exportId,
    action: "evidence.audit_export",
    summary: "Auditor evidence pack exported",
    payload: {
      exportId,
      start: startIso,
      end: endIso,
      counts: payload.export.counts,
    },
  });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = getExportInputFromSearchParams(searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId: parsed.tenantId,
      allowedRoles: [...API_TENANT_ROLES.mutate],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    return runExport(request, parsed, { userId: guard.userId, role: guard.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to export evidence pack", message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = getExportInputFromBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId: parsed.tenantId,
      allowedRoles: [...API_TENANT_ROLES.mutate],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    return runExport(request, parsed, { userId: guard.userId, role: guard.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to export evidence pack", message },
      { status: 500 }
    );
  }
}
