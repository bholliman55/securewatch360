import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccessForFinding } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

type AssigneeBody = {
  assignedToUserId?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid finding id" }, { status: 400 });
    }

    const body = (await request.json()) as AssigneeBody;
    const assignee =
      typeof body.assignedToUserId === "string" ? body.assignedToUserId.trim() : "";

    if (assignee.length > 0 && !isUuid(assignee)) {
      return NextResponse.json(
        { ok: false, error: "assignedToUserId must be a valid UUID or empty" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccessForFinding({
      findingId: id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("findings")
      .update({
        assigned_to_user_id: assignee || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, assigned_to_user_id, notes, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: guard.tenantId,
      entityType: "finding",
      entityId: id,
      action: "finding.assignee.updated",
      summary: `Finding assignee updated to ${assignee || "unassigned"}`,
      payload: {
        findingId: id,
        assignedToUserId: assignee || null,
      },
    });

    return NextResponse.json({ ok: true, finding: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to assign finding", message },
      { status: 500 }
    );
  }
}
