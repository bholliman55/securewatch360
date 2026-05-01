import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { pushTicketingAfterRemediationComplete } from "@/lib/remediationConnectors/ticketingOutbound";
import { execFile as execFileShell } from "node:child_process";

type ExecutionStep = {
  name: string;
  status: "completed" | "simulated" | "skipped";
  detail: string;
  stdout?: string;
  stderr?: string;
};

// Strict allowlist for template variable values to prevent command injection.
// Values must only contain safe filesystem/identifier characters.
const SAFE_VALUE_RE = /^[a-zA-Z0-9._\-:/]{1,256}$/;
const SUPPORTED_ADAPTERS = new Set(["script_runner", "ansible", "cloud_api", "ticketing"]);

function sanitizeTemplateValue(value: string): string {
  if (!SAFE_VALUE_RE.test(value)) {
    throw new Error(`Unsafe value in command template: "${value.slice(0, 32)}…"`);
  }
  return value;
}

// Splits a pre-configured admin command template into [executable, ...args] and
// substitutes {{variable}} placeholders with sanitized values. Uses execFile()
// so the shell never interprets the arguments, eliminating command injection risk.
function parseCommandTemplate(
  template: string,
  context: { target: string; tenantId: string; findingId: string; actionType: string }
): [string, string[]] {
  const safeContext = {
    target: sanitizeTemplateValue(context.target),
    tenantId: sanitizeTemplateValue(context.tenantId),
    findingId: sanitizeTemplateValue(context.findingId),
    actionType: sanitizeTemplateValue(context.actionType),
  };
  const filled = template
    .replaceAll("{{target}}", safeContext.target)
    .replaceAll("{{tenantId}}", safeContext.tenantId)
    .replaceAll("{{findingId}}", safeContext.findingId)
    .replaceAll("{{actionType}}", safeContext.actionType);

  // Shell-split the filled template into argv (no shell execution).
  const parts = filled.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new Error("Empty command after template substitution");
  return [parts[0], parts.slice(1)];
}


function adapterEnvSegment(adapterKey: string | undefined): string {
  if (!adapterKey || typeof adapterKey !== "string" || adapterKey.trim().length === 0) {
    return "DEFAULT";
  }
  return adapterKey
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function resolveCommandForStep(args: {
  adapterKey: string | undefined;
  step: "ISOLATE" | "VLAN" | "PATCH" | "REIMAGE" | "DEFAULT";
  legacyEnv: string | undefined;
}): string | undefined {
  const seg = adapterEnvSegment(args.adapterKey);
  const key = `REMEDIATION_EXEC_${seg}_${args.step}_COMMAND`;
  const specific = process.env[key];
  if (typeof specific === "string" && specific.trim().length > 0) {
    return specific;
  }
  if (typeof args.legacyEnv === "string" && args.legacyEnv.trim().length > 0) {
    return args.legacyEnv;
  }
  return undefined;
}

async function buildExecutionSteps(args: {
  actionType: string;
  dryRun: boolean;
  containment: Record<string, unknown> | null;
  tenantId: string;
  findingId: string;
  target: string;
  adapterKey: string | undefined;
}): Promise<ExecutionStep[]> {
  const context = {
    target: args.target,
    tenantId: args.tenantId,
    findingId: args.findingId,
    actionType: args.actionType,
  };
  const steps: ExecutionStep[] = [];
  const adapter = args.adapterKey;

  const runTemplateStep = async (
    stepName: string,
    commandTemplate: string | undefined,
    fallbackDetail: string
  ): Promise<ExecutionStep> => {
    if (args.dryRun) {
      return { name: stepName, status: "simulated", detail: fallbackDetail };
    }
    if (adapter === "ticketing" && (!commandTemplate || commandTemplate.trim().length === 0)) {
      return {
        name: stepName,
        status: "skipped",
        detail:
          "Adapter `ticketing` does not use local shell steps by default; use a connector (e.g. API) or set an explicit REMEDIATION_EXEC_*_COMMAND.",
      };
    }
    if (!commandTemplate || commandTemplate.trim().length === 0) {
      return {
        name: stepName,
        status: "skipped",
        detail: "No command configured; mark simulated completion.",
      };
    }
    // Use execFile via parseCommandTemplate — no shell interpretation, no injection risk.
    const [file, argv] = parseCommandTemplate(commandTemplate, context);
    const output = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFileShell(file, argv, { timeout: 120_000, windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${file}\n${stderr || stdout || error.message}`));
          return;
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
    return {
      name: stepName,
      status: "completed",
      detail: `Executed: ${file}`,
      stdout: output.stdout || undefined,
      stderr: output.stderr || undefined,
    };
  };

  if (args.actionType === "isolate") {
    if (args.containment?.takeOffline) {
      const cmd = resolveCommandForStep({
        adapterKey: adapter,
        step: "ISOLATE",
        legacyEnv: process.env.REMEDIATION_EXEC_ISOLATE_COMMAND,
      });
      steps.push(
        await runTemplateStep(
          "device.offline",
          cmd,
          "Device isolation requested."
        )
      );
    }
    if (args.containment?.vlanQuarantine) {
      const cmd = resolveCommandForStep({
        adapterKey: adapter,
        step: "VLAN",
        legacyEnv: process.env.REMEDIATION_EXEC_VLAN_COMMAND,
      });
      steps.push(
        await runTemplateStep(
          "network.vlan.quarantine",
          cmd,
          "Quarantine VLAN assignment requested."
        )
      );
    }
  } else if (args.actionType === "patch") {
    const cmd = resolveCommandForStep({
      adapterKey: adapter,
      step: "PATCH",
      legacyEnv: process.env.REMEDIATION_EXEC_PATCH_COMMAND,
    });
    steps.push(
      await runTemplateStep(
        "remediation.patch",
        cmd,
        "Patch action requested."
      )
    );
  } else if (args.actionType === "reimage") {
    const cmd = resolveCommandForStep({
      adapterKey: adapter,
      step: "REIMAGE",
      legacyEnv: process.env.REMEDIATION_EXEC_REIMAGE_COMMAND,
    });
    steps.push(
      await runTemplateStep(
        "remediation.reimage",
        cmd,
        "Reimage action requested."
      )
    );
  } else {
    const cmd = resolveCommandForStep({
      adapterKey: adapter,
      step: "DEFAULT",
      legacyEnv: process.env.REMEDIATION_EXEC_DEFAULT_COMMAND,
    });
    steps.push(
      await runTemplateStep(
        "remediation.execute",
        cmd,
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
      "id, tenant_id, finding_id, title, description, action_type, action_status, execution_status, execution_mode, execution_payload, notes"
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

  const allowedStartStates = force ? ["approved", "queued", "pending"] : ["approved", "queued"];
  const { data: runningRow, error: runningError } = await supabase
    .from("remediation_actions")
    .update(runningUpdates)
    .eq("id", input.remediationActionId)
    .in("execution_status", allowedStartStates)
    .select("id")
    .maybeSingle();
  if (runningError || !runningRow) {
    throw new Error(
      `Failed to mark remediation action running (stale state or concurrent execution): ${runningError?.message ?? "state transition rejected"}`
    );
  }

  const payload = (remediation.execution_payload ?? {}) as Record<string, unknown>;
  const containment = (payload.containment ?? null) as Record<string, unknown> | null;
  const execution = (payload.execution ?? {}) as Record<string, unknown>;
  const integration = (payload.integration ?? null) as Record<string, unknown> | null;
  const adapterKey =
    typeof integration?.adapterKey === "string" && integration.adapterKey.trim().length > 0
      ? integration.adapterKey.trim()
      : undefined;
  if (adapterKey && !SUPPORTED_ADAPTERS.has(adapterKey)) {
    throw new Error(`Unsupported remediation adapter: ${adapterKey}`);
  }
  const connector =
    typeof integration?.connector === "string" && integration.connector.trim().length > 0
      ? integration.connector.trim()
      : undefined;
  const target =
    (typeof execution.targetValue === "string" && execution.targetValue.trim().length > 0
      ? execution.targetValue
      : remediation.finding_id) || "unknown-target";

  const markFailed = async (error: unknown) => {
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
    await writeAuditLog({
      userId: input.actorUserId,
      tenantId: remediation.tenant_id,
      entityType: "remediation_action",
      entityId: input.remediationActionId,
      action: "remediation.execution.failed",
      summary: `Remediation execution failed for action ${input.remediationActionId}`,
      payload: {
        remediationActionId: input.remediationActionId,
        findingId: remediation.finding_id,
        actionType: remediation.action_type,
        executionMode: remediation.execution_mode,
        source: input.executionSource,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  };

  let executionSteps: ExecutionStep[];
  try {
    executionSteps = await buildExecutionSteps({
      actionType: remediation.action_type,
      dryRun,
      containment,
      tenantId: remediation.tenant_id,
      findingId: remediation.finding_id,
      target,
      adapterKey,
    });
  } catch (error) {
    await markFailed(error);
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
    integration:
      adapterKey || connector
        ? {
            adapterKey: adapterKey ?? null,
            connector: connector ?? null,
            commandResolution: "adapter_env_with_legacy_fallback",
          }
        : undefined,
    steps: executionSteps,
    note: note || null,
  };

  const completedAt = new Date().toISOString();
  const allStepsSkipped = executionSteps.every((step) => step.status === "skipped");
  const terminalExecutionStatus = allStepsSkipped && !dryRun ? "cancelled" : "completed";
  const terminalActionStatus = allStepsSkipped && !dryRun ? "approved" : "completed";
  const completedUpdates: Record<string, unknown> = {
    execution_status: terminalExecutionStatus,
    action_status: terminalActionStatus,
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
    const err = new Error(completeError?.message ?? "Failed to finalize remediation execution");
    await markFailed(err);
    throw err;
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
      terminalExecutionStatus,
      allStepsSkipped,
    },
  });

  if (!dryRun && terminalExecutionStatus === "completed") {
    const ticketing = await pushTicketingAfterRemediationComplete({
      tenantId: remediation.tenant_id,
      remediationActionId: input.remediationActionId,
      title: String(remediation.title ?? "Remediation action"),
      description: String(remediation.description ?? ""),
      adapterKey,
    });
    if (ticketing.detail !== "skipped_not_configured") {
      await writeAuditLog({
        userId: input.actorUserId,
        tenantId: remediation.tenant_id,
        entityType: "remediation_action",
        entityId: input.remediationActionId,
        action: ticketing.ok ? "remediation.ticketing.outbound" : "remediation.ticketing.outbound_failed",
        summary: ticketing.ok
          ? `Ticketing connector push: ${ticketing.detail}`
          : `Ticketing connector push failed: ${ticketing.detail}`,
        payload: {
          remediationActionId: input.remediationActionId,
          detail: ticketing.detail,
        },
      });
    }
  }

  if (terminalExecutionStatus === "completed") {
    await inngest.send({
      name: "securewatch/remediation.execution.completed",
      data: {
        tenantId: remediation.tenant_id,
        remediationActionId: input.remediationActionId,
        findingId: remediation.finding_id,
        triggerType: remediation.execution_mode,
      },
    });
  }

  return {
    remediationAction: (updated ?? {}) as Record<string, unknown>,
    tenantId: remediation.tenant_id,
    findingId: remediation.finding_id,
    actionType: remediation.action_type,
    executionMode: remediation.execution_mode,
  };
}
