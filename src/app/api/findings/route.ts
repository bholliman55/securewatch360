import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { FINDING_STATUSES } from "@/lib/statuses";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { requireTenantAccess } from "@/lib/tenant-guard";

const allowedSeverities = ["info", "low", "medium", "high", "critical"] as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const scanRunId = searchParams.get("scanRunId")?.trim() ?? "";
    const severity = searchParams.get("severity")?.trim().toLowerCase() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 200;

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
    }

    if (!isUuid(tenantId)) {
      return NextResponse.json(
        { ok: false, error: "tenantId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (scanRunId.length > 0 && !isUuid(scanRunId)) {
      return NextResponse.json(
        { ok: false, error: "scanRunId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (severity.length > 0 && !allowedSeverities.includes(severity as (typeof allowedSeverities)[number])) {
      return NextResponse.json(
        { ok: false, error: `severity must be one of: ${allowedSeverities.join(", ")}` },
        { status: 400 }
      );
    }

    if (status.length > 0 && !FINDING_STATUSES.includes(status as (typeof FINDING_STATUSES)[number])) {
      return NextResponse.json(
        { ok: false, error: `status must be one of: ${FINDING_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (category.length > 100) {
      return NextResponse.json(
        { ok: false, error: "category must be 100 characters or less" },
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
      allowedRoles: [...API_TENANT_ROLES.read],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("findings")
      .select(
        "id, tenant_id, scan_run_id, severity, category, title, description, status, asset_type, exposure, priority_score, assigned_to_user_id, notes, created_at, updated_at"
      )
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    query = query.eq("tenant_id", tenantId);
    if (scanRunId.length > 0) {
      query = query.eq("scan_run_id", scanRunId);
    }
    if (severity.length > 0) {
      query = query.eq("severity", severity);
    }
    if (status.length > 0) {
      query = query.eq("status", status);
    }
    if (category.length > 0) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        findings: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load findings", message },
      { status: 500 }
    );
  }
}
