import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { REMEDIATION_ACTION_STATUSES, type RemediationActionStatus } from "@/types/remediation";
import { writeAuditLog } from "@/lib/audit";

type UpdateRemediationStatusBody = {
  actionStatus?: unknown;
  assignedToUserId?: unknown;
  note?: unknown;
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
      return NextResponse.json({ ok: false, error: "Invalid remediation action id" }, { status: 400 });
    }

    let body: UpdateRemediationStatusBody;
    try {
      body = (await request.json()) as UpdateRemediationStatusBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const actionStatus =
      typeof body.actionStatus === "string" ? body.actionStatus.trim().toLowerCase() : "";
    if (!REMEDIATION_ACTION_STATUSES.includes(actionStatus as RemediationActionStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `actionStatus must be one of: ${REMEDIATION_ACTION_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (actionStatus === "completed" || actionStatus === "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: "actionStatus completed/failed must be set by the execution worker endpoint",
        },
        { status: 400 }
      );
    }

    const assignedToUserId =
      typeof body.assignedToUserId === "string" ? body.assignedToUserId.trim() : undefined;
    if (typeof assignedToUserId === "string" && assignedToUserId.length > 0 && !isUuid(assignedToUserId)) {
      return NextResponse.json(
        { ok: false, error: "assignedToUserId must be a valid UUID or empty" },
        { status: 400 }
      );
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "note must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("remediation_actions")
      .select("id, tenant_id, notes")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { ok: false, error: existingError?.message ?? "Remediation action not found" },
        { status: 404 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: existing.tenant_id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const updates: Record<string, unknown> = {
      action_status: actionStatus,
      updated_at: new Date().toISOString(),
    };
    if (typeof assignedToUserId === "string") {
      updates.assigned_to_user_id = assignedToUserId || null;
    }
    if (note.length > 0) {
      const stamped = `[${new Date().toISOString()}] ${note}`;
      updates.notes = existing.notes ? `${existing.notes}\n${stamped}` : stamped;
    }

    const { data, error } = await supabase
      .from("remediation_actions")
      .update(updates)
      .eq("id", id)
      .select(
        "id, tenant_id, finding_id, action_type, action_status, assigned_to_user_id, notes, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update remediation action");
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: existing.tenant_id,
      entityType: "remediation_action",
      entityId: id,
      action: "remediation.status.updated",
      summary: `Remediation action status set to ${actionStatus}`,
      payload: {
        remediationActionId: id,
        actionStatus,
        assignedToUserId: typeof assignedToUserId === "string" ? assignedToUserId || null : undefined,
        noteAdded: note.length > 0,
      },
    });

    return NextResponse.json({ ok: true, remediationAction: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to update remediation status", message },
      { status: 500 }
    );
  }
}
