import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { parsePagination } from "@/lib/apiPagination";

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
    const pagination = parsePagination({
      rawLimit: searchParams.get("limit"),
      rawOffset: searchParams.get("offset"),
      defaultLimit: 200,
      maxLimit: 500,
    });

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (findingId.length > 0 && !isUuid(findingId)) {
      return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
    }
    if (!pagination.ok) {
      return NextResponse.json({ ok: false, error: pagination.error }, { status: 400 });
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
      .range(pagination.offset, pagination.offset + pagination.limit - 1);

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
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
        },
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
