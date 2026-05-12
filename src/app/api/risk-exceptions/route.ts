import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { requireTenantAccessForFinding } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";
import { addHoursIsoString, getRiskExceptionReviewSlaHours } from "@/lib/sla";
import { RISK_EXCEPTION_STATUSES, type RiskExceptionStatus } from "@/types/risk-exception";

type RequestRiskExceptionBody = {
  findingId?: unknown;
  justification?: unknown;
  expiresAt?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function parseOptionalFutureDate(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: "expiresAt must be an ISO datetime string" };
  }

  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "expiresAt must be a valid ISO datetime string" };
  }
  if (date.getTime() <= Date.now()) {
    return { ok: false, error: "expiresAt must be in the future" };
  }
  return { ok: true, value: date.toISOString() };
}

export async function POST(request: Request) {
  try {
    let body: RequestRiskExceptionBody;
    try {
      body = (await request.json()) as RequestRiskExceptionBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const findingId = typeof body.findingId === "string" ? body.findingId.trim() : "";
    const justification = typeof body.justification === "string" ? body.justification.trim() : "";

    if (!findingId || !isUuid(findingId)) {
      return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
    }
    if (!justification) {
      return NextResponse.json({ ok: false, error: "justification is required" }, { status: 400 });
    }
    if (justification.length > 3000) {
      return NextResponse.json(
        { ok: false, error: "justification must be 3000 characters or less" },
        { status: 400 }
      );
    }

    const parsedExpiresAt = parseOptionalFutureDate(body.expiresAt);
    if (!parsedExpiresAt.ok) {
      return NextResponse.json({ ok: false, error: parsedExpiresAt.error }, { status: 400 });
    }

    const guard = await requireTenantAccessForFinding({
      findingId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    const { data: existingRequest, error: existingError } = await supabase
      .from("risk_exceptions")
      .select("id, status")
      .eq("tenant_id", guard.tenantId)
      .eq("finding_id", findingId)
      .in("status", ["requested", "approved"])
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (existingRequest) {
      return NextResponse.json(
        { ok: false, error: `Active risk exception already exists (status=${existingRequest.status})` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const reviewH = getRiskExceptionReviewSlaHours();
    const reviewSlaDueAt = addHoursIsoString(now, reviewH);
    const { data, error } = await supabase
      .from("risk_exceptions")
      .insert({
        tenant_id: guard.tenantId,
        finding_id: findingId,
        requested_by_user_id: guard.userId,
        approved_by_user_id: null,
        status: "requested",
        justification,
        expires_at: parsedExpiresAt.value,
        updated_at: now,
        review_sla_due_at: reviewSlaDueAt,
        escalation_level: 0,
      })
      .select(
        "id, tenant_id, finding_id, requested_by_user_id, approved_by_user_id, status, justification, expires_at, created_at, updated_at, review_sla_due_at, sla_breached_at, escalation_level"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create risk exception");
    }

    const { error: findingUpdateError } = await supabase
      .from("findings")
      .update({
        exception_status: "requested",
        updated_at: now,
      })
      .eq("id", findingId)
      .eq("tenant_id", guard.tenantId);

    if (findingUpdateError) {
      throw new Error(`Risk exception created but finding update failed: ${findingUpdateError.message}`);
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: guard.tenantId,
      entityType: "risk_exception",
      entityId: data.id,
      action: "risk.exception.requested",
      summary: "Risk exception requested",
      payload: {
        riskExceptionId: data.id,
        findingId,
        expiresAt: parsedExpiresAt.value,
      },
    });

    return NextResponse.json({ ok: true, riskException: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to request risk exception", message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 100;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (status && !RISK_EXCEPTION_STATUSES.includes(status as RiskExceptionStatus)) {
      return NextResponse.json(
        { ok: false, error: `status must be one of: ${RISK_EXCEPTION_STATUSES.join(", ")}` },
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
      .from("risk_exceptions")
      .select(
        "id, tenant_id, finding_id, requested_by_user_id, approved_by_user_id, status, justification, expires_at, created_at, updated_at, review_sla_due_at, sla_breached_at, escalation_level"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        riskExceptions: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load risk exceptions", message },
      { status: 500 }
    );
  }
}
