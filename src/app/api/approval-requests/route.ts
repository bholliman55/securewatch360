import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";
import { APPROVAL_REQUEST_STATUSES, APPROVAL_TYPES, type ApprovalType } from "@/types/approval";

type CreateApprovalRequestBody = {
  tenantId?: unknown;
  findingId?: unknown;
  remediationActionId?: unknown;
  assignedApproverUserId?: unknown;
  approvalType?: unknown;
  reason?: unknown;
  requestPayload?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request) {
  try {
    let body: CreateApprovalRequestBody;
    try {
      body = (await request.json()) as CreateApprovalRequestBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const findingId = typeof body.findingId === "string" ? body.findingId.trim() : "";
    const remediationActionId =
      typeof body.remediationActionId === "string" ? body.remediationActionId.trim() : "";
    const assignedApproverUserId =
      typeof body.assignedApproverUserId === "string" ? body.assignedApproverUserId.trim() : "";
    const approvalType =
      typeof body.approvalType === "string" ? body.approvalType.trim().toLowerCase() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const requestPayload =
      body.requestPayload && typeof body.requestPayload === "object"
        ? (body.requestPayload as Record<string, unknown>)
        : {};

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!findingId && !remediationActionId) {
      return NextResponse.json(
        { ok: false, error: "Either findingId or remediationActionId is required" },
        { status: 400 }
      );
    }
    if (findingId && !isUuid(findingId)) {
      return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
    }
    if (remediationActionId && !isUuid(remediationActionId)) {
      return NextResponse.json(
        { ok: false, error: "remediationActionId must be a valid UUID" },
        { status: 400 }
      );
    }
    if (assignedApproverUserId && !isUuid(assignedApproverUserId)) {
      return NextResponse.json(
        { ok: false, error: "assignedApproverUserId must be a valid UUID" },
        { status: 400 }
      );
    }
    if (!APPROVAL_TYPES.includes(approvalType as ApprovalType)) {
      return NextResponse.json(
        { ok: false, error: `approvalType must be one of: ${APPROVAL_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!reason) {
      return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });
    }
    if (reason.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "reason must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    if (findingId) {
      const { data, error } = await supabase
        .from("findings")
        .select("id")
        .eq("id", findingId)
        .eq("tenant_id", tenantId)
        .single();
      if (error || !data) {
        return NextResponse.json(
          { ok: false, error: error?.message ?? "findingId not found for tenant" },
          { status: 404 }
        );
      }
    }

    if (remediationActionId) {
      const { data, error } = await supabase
        .from("remediation_actions")
        .select("id")
        .eq("id", remediationActionId)
        .eq("tenant_id", tenantId)
        .single();
      if (error || !data) {
        return NextResponse.json(
          { ok: false, error: error?.message ?? "remediationActionId not found for tenant" },
          { status: 404 }
        );
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        tenant_id: tenantId,
        finding_id: findingId || null,
        remediation_action_id: remediationActionId || null,
        requested_by_user_id: guard.userId,
        assigned_approver_user_id: assignedApproverUserId || null,
        approval_type: approvalType,
        status: APPROVAL_REQUEST_STATUSES[0], // pending
        reason,
        request_payload: requestPayload,
        response_payload: {},
        updated_at: now,
      })
      .select(
        "id, tenant_id, finding_id, remediation_action_id, requested_by_user_id, assigned_approver_user_id, approval_type, status, reason, request_payload, response_payload, created_at, updated_at, resolved_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create approval request");
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "approval_request",
      entityId: data.id,
      action: "approval.request.created",
      summary: `Approval request created (${approvalType})`,
      payload: {
        approvalRequestId: data.id,
        approvalType,
        findingId: findingId || null,
        remediationActionId: remediationActionId || null,
        assignedApproverUserId: assignedApproverUserId || null,
      },
    });

    return NextResponse.json({ ok: true, approvalRequest: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create approval request", message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const assignedApproverUserId = searchParams.get("assignedApproverUserId")?.trim() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "";
    const limit = limitParam.length > 0 ? Number(limitParam) : 100;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (status && !APPROVAL_REQUEST_STATUSES.includes(status as (typeof APPROVAL_REQUEST_STATUSES)[number])) {
      return NextResponse.json(
        { ok: false, error: `status must be one of: ${APPROVAL_REQUEST_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (assignedApproverUserId && !isUuid(assignedApproverUserId)) {
      return NextResponse.json(
        { ok: false, error: "assignedApproverUserId must be a valid UUID" },
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
      .from("approval_requests")
      .select(
        "id, tenant_id, finding_id, remediation_action_id, requested_by_user_id, assigned_approver_user_id, approval_type, status, reason, request_payload, response_payload, created_at, updated_at, resolved_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (assignedApproverUserId) query = query.eq("assigned_approver_user_id", assignedApproverUserId);

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        approvalRequests: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load approval requests", message },
      { status: 500 }
    );
  }
}
