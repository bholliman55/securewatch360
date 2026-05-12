import { actionExecutionInputSchema, type ActionExecutionResult } from "./action.schema";
import type { ActionAuditLogger } from "./actionAuditLogger";
import type { ActionRegistry } from "./actionRegistry";
import type { RollbackManager } from "./rollbackManager";

/**
 * Executes a registered action with tenant scope, dry-run support, approval gating, audit, and rollback registration.
 */
export async function executeAction(
  registry: ActionRegistry,
  rollbackManager: RollbackManager,
  audit: ActionAuditLogger,
  rawInput: unknown,
): Promise<ActionExecutionResult> {
  const parsed = actionExecutionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(`Invalid action execution input: ${parsed.error.message}`);
  }
  const input = parsed.data;
  const def = registry.require(input.type);

  await audit.logRequested(input);

  if (!input.dry_run && def.requiresApproval && !input.approval_reference?.trim()) {
    const blocked: ActionExecutionResult = {
      ok: false,
      dry_run: false,
      type: input.type,
      correlation_id: input.correlation_id,
      evidence: { reason: "approval_reference_required_for_high_risk_action" },
      approval_required: true,
    };
    await audit.logOutcome(input, blocked);
    return blocked;
  }

  const ctx = {
    tenantId: input.tenant_id,
    dryRun: input.dry_run,
    params: input.params,
    correlationId: input.correlation_id,
    actorUserId: input.actor_user_id ?? null,
  };

  try {
    const handlerResult = await def.execute(ctx);
    const result: ActionExecutionResult = {
      ok: handlerResult.ok,
      dry_run: input.dry_run,
      type: input.type,
      correlation_id: input.correlation_id,
      evidence: handlerResult.evidence,
      rollback_token: handlerResult.rollback_token,
    };

    if (
      handlerResult.ok &&
      handlerResult.rollback_token &&
      def.rollback &&
      !input.dry_run
    ) {
      rollbackManager.register({
        token: handlerResult.rollback_token,
        tenantId: input.tenant_id,
        type: input.type,
        correlationId: input.correlation_id,
        rollback: () =>
          def.rollback!({
            ...ctx,
            rollback_token: handlerResult.rollback_token!,
          }),
      });
    }

    await audit.logOutcome(input, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed: ActionExecutionResult = {
      ok: false,
      dry_run: input.dry_run,
      type: input.type,
      correlation_id: input.correlation_id,
      evidence: { error: message },
      error: message,
    };
    await audit.logOutcome(input, failed);
    return failed;
  }
}

/** Run a previously registered rollback hook (tenant-scoped). */
export async function executeRegisteredRollback(
  rollbackManager: RollbackManager,
  audit: ActionAuditLogger,
  params: { token: string; tenantId: string },
): Promise<void> {
  const outcome = await rollbackManager.executeRollback(params);
  const actionType = outcome.meta?.type ?? "rollback_policy";
  const correlationId = outcome.meta?.correlationId ?? params.token;

  await audit.log({
    tenantId: params.tenantId,
    correlationId,
    phase: outcome.ok ? "action.rollback.succeeded" : "action.rollback.failed",
    actionType,
    summary: outcome.ok ? "Rollback succeeded" : "Rollback failed",
    payload: { rollback_token: params.token, outcome },
  });
}
