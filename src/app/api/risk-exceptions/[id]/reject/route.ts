import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid risk exception id" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("risk_exceptions")
      .select("id, tenant_id, finding_id, status")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { ok: false, error: existingError?.message ?? "Risk exception not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "requested") {
      return NextResponse.json(
        { ok: false, error: `Risk exception is not requestable (status=${existing.status})` },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: existing.tenant_id,
      allowedRoles: ["owner", "admin"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("risk_exceptions")
      .update({
        status: "rejected",
        approved_by_user_id: guard.userId,
        updated_at: now,
      })
      .eq("id", id)
      .eq("tenant_id", existing.tenant_id)
      .select(
        "id, tenant_id, finding_id, requested_by_user_id, approved_by_user_id, status, justification, expires_at, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to reject risk exception");
    }

    const { error: findingError } = await supabase
      .from("findings")
      .update({
        exception_status: "denied",
        updated_at: now,
      })
      .eq("id", existing.finding_id);

    if (findingError) {
      throw new Error(`Risk exception rejected but finding update failed: ${findingError.message}`);
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: existing.tenant_id,
      entityType: "risk_exception",
      entityId: id,
      action: "risk.exception.rejected",
      summary: "Risk exception rejected",
      payload: {
        riskExceptionId: id,
        findingId: existing.finding_id,
      },
    });

    return NextResponse.json({ ok: true, riskException: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to reject risk exception", message },
      { status: 500 }
    );
  }
}
