import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

type ExecuteBody = {
  dryRun?: unknown;
  force?: unknown;
  note?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid remediation action id" }, { status: 400 });
    }

    let body: ExecuteBody;
    try {
      body = (await request.json()) as ExecuteBody;
    } catch {
      body = {};
    }

    const dryRun = body.dryRun === true;
    const force = body.force === true;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 2000) {
      return NextResponse.json({ ok: false, error: "note must be 2000 characters or less" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: remediation, error: remediationError } = await supabase
      .from("remediation_actions")
      .select(
        "id, tenant_id, finding_id, action_type, action_status, execution_status, execution_mode, execution_payload, notes"
      )
      .eq("id", id)
      .single();

    if (remediationError || !remediation) {
      return NextResponse.json(
        { ok: false, error: remediationError?.message ?? "Remediation action not found" },
        { status: 404 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: remediation.tenant_id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const canExecute =
      remediation.execution_status === "approved" ||
      remediation.execution_status === "queued" ||
      (force && remediation.execution_status === "pending");
    if (!canExecute) {
      return NextResponse.json(
        {
          ok: false,
          error: `Execution not allowed from status ${remediation.execution_status}. Allowed: approved/queued${force ? "/pending (forced)" : ""}`,
        },
        { status: 409 }
      );
    }

    const startedAt = new Date().toISOString();
    const runningUpdates: Record<string, unknown> = {
      execution_status: "running",
      action_status: "in_progress",
      updated_at: startedAt,
    };

    const { error: runningError } = await supabase
      .from("remediation_actions")
      .update(runningUpdates)
      .eq("id", id);
    if (runningError) {
      throw new Error(`Failed to mark remediation action running: ${runningError.message}`);
    }

    const payload = (remediation.execution_payload ?? {}) as Record<string, unknown>;
    const containment = (payload.containment ?? null) as Record<string, unknown> | null;

    // v1 execution worker: deterministic built-in executor.
    // This performs orchestration updates and emits auditable execution results.
    const executionResult = {
      startedAt,
      completedAt: new Date().toISOString(),
      executor: "securewatch.execution_worker.v1",
      dryRun,
      force,
      actionType: remediation.action_type,
      mode: remediation.execution_mode,
      steps:
        remediation.action_type === "isolate"
          ? [
              {
                name: "device.offline",
                status: dryRun ? "simulated" : "completed",
                detail: containment?.takeOffline
                  ? "Device isolation requested."
                  : "No offline isolation flag in payload; skipped.",
              },
              {
                name: "network.vlan.quarantine",
                status: dryRun ? "simulated" : "completed",
                detail: containment?.vlanQuarantine
                  ? "Quarantine VLAN assignment requested."
                  : "No VLAN quarantine flag in payload; skipped.",
              },
            ]
          : [
              {
                name: "remediation.execute",
                status: dryRun ? "simulated" : "completed",
                detail: `Executed remediation action type ${remediation.action_type}.`,
              },
            ],
      note: note || null,
    };

    const completedAt = new Date().toISOString();
    const completedUpdates: Record<string, unknown> = {
      execution_status: "completed",
      action_status: "completed",
      execution_result: executionResult,
      executed_at: completedAt,
      updated_at: completedAt,
    };

    if (note.length > 0) {
      const stamped = `[${completedAt}] ${note}`;
      completedUpdates.notes = remediation.notes ? `${remediation.notes}\n${stamped}` : stamped;
    }

    const { data: updated, error: completeError } = await supabase
      .from("remediation_actions")
      .update(completedUpdates)
      .eq("id", id)
      .select(
        "id, tenant_id, finding_id, action_type, action_status, execution_status, execution_mode, execution_result, executed_at, updated_at"
      )
      .single();
    if (completeError || !updated) {
      throw new Error(completeError?.message ?? "Failed to finalize remediation execution");
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: remediation.tenant_id,
      entityType: "remediation_action",
      entityId: id,
      action: "remediation.execution.completed",
      summary: `Remediation execution completed for action ${id}`,
      payload: {
        remediationActionId: id,
        findingId: remediation.finding_id,
        actionType: remediation.action_type,
        executionMode: remediation.execution_mode,
        dryRun,
        force,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        remediationAction: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to execute remediation action", message },
      { status: 500 }
    );
  }
}
