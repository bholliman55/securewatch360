import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { exec as execShell } from "node:child_process";

type ExecutionStep = {
  name: string;
  status: "completed" | "simulated" | "skipped";
  detail: string;
  stdout?: string;
  stderr?: string;
};

function runShellCommand(command: string, timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execShell(command, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${command}\n${stderr || stdout || error.message}`));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function fillCommandTemplate(
  template: string,
  context: { target: string; tenantId: string; findingId: string; actionType: string }
): string {
  return template
    .replaceAll("{{target}}", context.target)
    .replaceAll("{{tenantId}}", context.tenantId)
    .replaceAll("{{findingId}}", context.findingId)
    .replaceAll("{{actionType}}", context.actionType);
}

async function buildExecutionSteps(args: {
  actionType: string;
  dryRun: boolean;
  containment: Record<string, unknown> | null;
  tenantId: string;
  findingId: string;
  target: string;
}): Promise<ExecutionStep[]> {
  const context = {
    target: args.target,
    tenantId: args.tenantId,
    findingId: args.findingId,
    actionType: args.actionType,
  };
  const steps: ExecutionStep[] = [];

  const runTemplateStep = async (
    stepName: string,
    commandTemplate: string | undefined,
    fallbackDetail: string
  ): Promise<ExecutionStep> => {
    if (args.dryRun) {
      return { name: stepName, status: "simulated", detail: fallbackDetail };
    }
    if (!commandTemplate || commandTemplate.trim().length === 0) {
      return {
        name: stepName,
        status: "skipped",
        detail: "No command configured; mark simulated completion.",
      };
    }
    const command = fillCommandTemplate(commandTemplate, context);
    const output = await runShellCommand(command);
    return {
      name: stepName,
      status: "completed",
      detail: `Executed command: ${command}`,
      stdout: output.stdout || undefined,
      stderr: output.stderr || undefined,
    };
  };

  if (args.actionType === "isolate") {
    if (args.containment?.takeOffline) {
      steps.push(
        await runTemplateStep(
          "device.offline",
          process.env.REMEDIATION_EXEC_ISOLATE_COMMAND,
          "Device isolation requested."
        )
      );
    }
    if (args.containment?.vlanQuarantine) {
      steps.push(
        await runTemplateStep(
          "network.vlan.quarantine",
          process.env.REMEDIATION_EXEC_VLAN_COMMAND,
          "Quarantine VLAN assignment requested."
        )
      );
    }
  } else if (args.actionType === "patch") {
    steps.push(
      await runTemplateStep(
        "remediation.patch",
        process.env.REMEDIATION_EXEC_PATCH_COMMAND,
        "Patch action requested."
      )
    );
  } else if (args.actionType === "reimage") {
    steps.push(
      await runTemplateStep(
        "remediation.reimage",
        process.env.REMEDIATION_EXEC_REIMAGE_COMMAND,
        "Reimage action requested."
      )
    );
  } else {
    steps.push(
      await runTemplateStep(
        "remediation.execute",
        process.env.REMEDIATION_EXEC_DEFAULT_COMMAND,
        `Executed remediation action type ${args.actionType}.`
      )
    );
  }

  if (steps.length === 0) {
    steps.push({
      name: "remediation.execute",
      status: args.dryRun ? "simulated" : "skipped",
      detail: "No executable steps resolved from remediation payload.",
    });
  }

  return steps;
}

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
  const execution = (payload.execution ?? {}) as Record<string, unknown>;
  const target =
    (typeof execution.targetValue === "string" && execution.targetValue.trim().length > 0
      ? execution.targetValue
      : remediation.finding_id) || "unknown-target";

  let executionSteps: ExecutionStep[];
  try {
    executionSteps = await buildExecutionSteps({
      actionType: remediation.action_type,
      dryRun,
      containment,
      tenantId: remediation.tenant_id,
      findingId: remediation.finding_id,
      target,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    await supabase
      .from("remediation_actions")
      .update({
        execution_status: "failed",
        action_status: "failed",
        execution_result: {
          startedAt,
          failedAt,
          executor: "securewatch.execution_worker.v2",
          source: input.executionSource,
          actionType: remediation.action_type,
          mode: remediation.execution_mode,
          error: error instanceof Error ? error.message : String(error),
        },
        updated_at: failedAt,
      })
      .eq("id", input.remediationActionId);
    throw error;
  }

  const executionResult = {
    startedAt,
    completedAt: new Date().toISOString(),
    executor: "securewatch.execution_worker.v2",
    source: input.executionSource,
    dryRun,
    force,
    actionType: remediation.action_type,
    mode: remediation.execution_mode,
    target,
    steps: executionSteps,
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
