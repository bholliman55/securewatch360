import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function executeRemediationActionById(input: {
  remediationActionId: string;
  actorUserId: string | null;
  dryRun?: boolean;
  force?: boolean;
  note?: string;
  executionSource: "api" | "workflow";
}): Promise<{
  remediationAction: Record<string, unknown>;
  tenantId: string;
  findingId: string;
  actionType: string;
  executionMode: string;
}> {
  const supabase = getSupabaseAdminClient();
  const dryRun = input.dryRun === true;
  const force = input.force === true;
  const note = typeof input.note === "string" ? input.note.trim() : "";

  const { data: remediation, error: remediationError } = await supabase
    .from("remediation_actions")
    .select(
      "id, tenant_id, finding_id, action_type, action_status, execution_status, execution_mode, execution_payload, notes"
    )
    .eq("id", input.remediationActionId)
    .single();

  if (remediationError || !remediation) {
    throw new Error(remediationError?.message ?? "Remediation action not found");
  }

  const canExecute =
    remediation.execution_status === "approved" ||
    remediation.execution_status === "queued" ||
    (force && remediation.execution_status === "pending");
  if (!canExecute) {
    throw new Error(
      `Execution not allowed from status ${remediation.execution_status}. Allowed: approved/queued${force ? "/pending (forced)" : ""}`
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
    .eq("id", input.remediationActionId);
  if (runningError) {
    throw new Error(`Failed to mark remediation action running: ${runningError.message}`);
  }

  const payload = (remediation.execution_payload ?? {}) as Record<string, unknown>;
  const containment = (payload.containment ?? null) as Record<string, unknown> | null;

  const executionResult = {
    startedAt,
    completedAt: new Date().toISOString(),
    executor: "securewatch.execution_worker.v1",
    source: input.executionSource,
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
    .eq("id", input.remediationActionId)
    .select(
      "id, tenant_id, finding_id, action_type, action_status, execution_status, execution_mode, execution_result, executed_at, updated_at"
    )
    .single();
  if (completeError || !updated) {
    throw new Error(completeError?.message ?? "Failed to finalize remediation execution");
  }

  await writeAuditLog({
    userId: input.actorUserId,
    tenantId: remediation.tenant_id,
    entityType: "remediation_action",
    entityId: input.remediationActionId,
    action: "remediation.execution.completed",
    summary: `Remediation execution completed for action ${input.remediationActionId}`,
    payload: {
      remediationActionId: input.remediationActionId,
      findingId: remediation.finding_id,
      actionType: remediation.action_type,
      executionMode: remediation.execution_mode,
      source: input.executionSource,
      dryRun,
      force,
    },
  });

  await inngest.send({
    name: "securewatch/remediation.execution.completed",
    data: {
      tenantId: remediation.tenant_id,
      remediationActionId: input.remediationActionId,
      findingId: remediation.finding_id,
      triggerType: remediation.execution_mode,
    },
  });

  return {
    remediationAction: (updated ?? {}) as Record<string, unknown>,
    tenantId: remediation.tenant_id,
    findingId: remediation.finding_id,
    actionType: remediation.action_type,
    executionMode: remediation.execution_mode,
  };
}
