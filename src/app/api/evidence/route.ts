import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const findingId = searchParams.get("findingId")?.trim() ?? "";
    const controlId = searchParams.get("controlId")?.trim() ?? "";
    const framework = searchParams.get("framework")?.trim().toLowerCase() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 200;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (findingId.length > 0 && !isUuid(findingId)) {
      return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
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
      .from("evidence_records")
      .select(
        "id, tenant_id, scan_run_id, finding_id, control_framework, control_id, evidence_type, title, description, payload, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (findingId.length > 0) query = query.eq("finding_id", findingId);
    if (controlId.length > 0) query = query.eq("control_id", controlId);
    if (framework.length > 0) query = query.eq("control_framework", framework);

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        evidence: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load evidence", message },
      { status: 500 }
    );
  }
}
