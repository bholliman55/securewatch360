import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { REMEDIATION_ACTION_TYPES, type RemediationActionType } from "@/types/remediation";
import { writeAuditLog } from "@/lib/audit";

type CreateRemediationBody = {
  findingId?: unknown;
  actionType?: unknown;
  assignedToUserId?: unknown;
  notes?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request) {
  try {
    let body: CreateRemediationBody;
    try {
      body = (await request.json()) as CreateRemediationBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const findingId = typeof body.findingId === "string" ? body.findingId.trim() : "";
    if (!findingId || !isUuid(findingId)) {
      return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
    }

    const actionType =
      typeof body.actionType === "string" ? body.actionType.trim().toLowerCase() : "manual_fix";
    if (!REMEDIATION_ACTION_TYPES.includes(actionType as RemediationActionType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `actionType must be one of: ${REMEDIATION_ACTION_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const assignedToUserId =
      typeof body.assignedToUserId === "string" ? body.assignedToUserId.trim() : "";
    if (assignedToUserId.length > 0 && !isUuid(assignedToUserId)) {
      return NextResponse.json(
        { ok: false, error: "assignedToUserId must be a valid UUID or empty" },
        { status: 400 }
      );
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "notes must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: finding, error: findingError } = await supabase
      .from("findings")
      .select("id, tenant_id, severity, title")
      .eq("id", findingId)
      .single();

    if (findingError || !finding) {
      return NextResponse.json(
        { ok: false, error: findingError?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: finding.tenant_id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const defaultNote = `Created from finding ${finding.id} (${finding.severity}): ${finding.title}`;
    const { data, error } = await supabase
      .from("remediation_actions")
      .insert({
        tenant_id: finding.tenant_id,
        finding_id: finding.id,
        action_type: actionType,
        action_status: "proposed",
        assigned_to_user_id: assignedToUserId || null,
        notes: notes || defaultNote,
      })
      .select(
        "id, tenant_id, finding_id, action_type, action_status, assigned_to_user_id, notes, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create remediation action");
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: finding.tenant_id,
      entityType: "remediation_action",
      entityId: data.id,
      action: "remediation.created",
      summary: `Remediation action created from finding ${finding.id}`,
      payload: {
        remediationActionId: data.id,
        findingId: finding.id,
        actionType,
        assignedToUserId: assignedToUserId || null,
      },
    });

    return NextResponse.json({ ok: true, remediationAction: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create remediation action", message },
      { status: 500 }
    );
  }
}
