import { writeAuditLog } from "@/lib/audit";
import type { ActionExecutionInput, ActionExecutionResult, ActionType } from "./action.schema";

export type ActionAuditPhase =
  | "action.execution.requested"
  | "action.execution.dry_run"
  | "action.execution.succeeded"
  | "action.execution.failed"
  | "action.execution.blocked_missing_approval"
  | "action.rollback.succeeded"
  | "action.rollback.failed";

/**
 * Emits structured audit rows for the action execution layer (tenant-scoped, correlation-keyed).
 */
export class ActionAuditLogger {
  constructor(private readonly actorUserId: string | null) {}

  async log(params: {
    tenantId: string;
    correlationId: string;
    phase: ActionAuditPhase;
    actionType: ActionType;
    summary: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await writeAuditLog({
      userId: this.actorUserId,
      tenantId: params.tenantId,
      entityType: "action_execution",
      entityId: params.correlationId,
      action: params.phase,
      summary: params.summary,
      payload: {
        action_type: params.actionType,
        correlation_id: params.correlationId,
        ...params.payload,
      },
    });
  }

  async logRequested(input: ActionExecutionInput): Promise<void> {
    await this.log({
      tenantId: input.tenant_id,
      correlationId: input.correlation_id,
      phase: input.dry_run ? "action.execution.dry_run" : "action.execution.requested",
      actionType: input.type,
      summary: input.dry_run ? `Dry run requested: ${input.type}` : `Execution requested: ${input.type}`,
      payload: {
        dry_run: input.dry_run,
        params: input.params,
        has_approval_reference: Boolean(input.approval_reference),
      },
    });
  }

  async logOutcome(input: ActionExecutionInput, result: ActionExecutionResult): Promise<void> {
    if (result.approval_required) {
      await this.log({
        tenantId: input.tenant_id,
        correlationId: input.correlation_id,
        phase: "action.execution.blocked_missing_approval",
        actionType: input.type,
        summary: `Blocked (approval required): ${input.type}`,
        payload: { result },
      });
      return;
    }

    await this.log({
      tenantId: input.tenant_id,
      correlationId: input.correlation_id,
      phase: result.ok ? "action.execution.succeeded" : "action.execution.failed",
      actionType: input.type,
      summary: result.ok ? `Succeeded: ${input.type}` : `Failed: ${input.type}`,
      payload: { result },
    });
  }
}
