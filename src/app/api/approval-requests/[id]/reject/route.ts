import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

type RejectBody = {
  reason?: unknown;
  responsePayload?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid approval request id" }, { status: 400 });
    }

    let body: RejectBody;
    try {
      body = (await request.json()) as RejectBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return NextResponse.json({ ok: false, error: "reason is required when rejecting" }, { status: 400 });
    }
    if (reason.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "reason must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const responsePayload =
      body.responsePayload && typeof body.responsePayload === "object"
        ? (body.responsePayload as Record<string, unknown>)
        : {};

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("approval_requests")
      .select(
        "id, tenant_id, finding_id, remediation_action_id, approval_type, status, assigned_approver_user_id, response_payload, resolved_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { ok: false, error: existingError?.message ?? "Approval request not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { ok: false, error: `Approval request is not pending (status=${existing.status})` },
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

    if (existing.assigned_approver_user_id && existing.assigned_approver_user_id !== guard.userId) {
      return NextResponse.json(
        { ok: false, error: "Only the assigned approver can reject this request" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("approval_requests")
      .update({
        status: "rejected",
        updated_at: now,
        resolved_at: now,
        response_payload: {
          ...(existing.response_payload ?? {}),
          ...responsePayload,
          decision: "rejected",
          rejectedByUserId: guard.userId,
          decisionReason: reason,
          decidedAt: now,
        },
      })
      .eq("id", id)
      .select(
        "id, tenant_id, finding_id, remediation_action_id, requested_by_user_id, assigned_approver_user_id, approval_type, status, reason, request_payload, response_payload, created_at, updated_at, resolved_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to reject request");
    }

    if (existing.approval_type === "remediation_execution" && existing.remediation_action_id) {
      const { error: remediationError } = await supabase
        .from("remediation_actions")
        .update({
          approval_status: "rejected",
          execution_status: "cancelled",
          action_status: "rejected",
          updated_at: now,
        })
        .eq("id", existing.remediation_action_id)
        .eq("tenant_id", existing.tenant_id);
      if (remediationError) {
        throw new Error(`Failed to apply rejection to remediation action: ${remediationError.message}`);
      }

      if (existing.finding_id) {
        await supabase
          .from("findings")
          .update({
            approval_status: "rejected",
            updated_at: now,
          })
          .eq("id", existing.finding_id)
          .eq("tenant_id", existing.tenant_id);
      }
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: existing.tenant_id,
      entityType: "approval_request",
      entityId: id,
      action: "approval.request.rejected",
      summary: "Approval request rejected",
      payload: {
        approvalRequestId: id,
        findingId: existing.finding_id,
        remediationActionId: existing.remediation_action_id,
        decisionReason: reason,
        responsePayload,
      },
    });

    return NextResponse.json({ ok: true, approvalRequest: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to reject request", message },
      { status: 500 }
    );
  }
}
