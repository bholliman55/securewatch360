import { ACTION_TYPES_REQUIRING_APPROVAL, type ActionType } from "./action.schema";
import type {
  ActionDefinition,
  ActionHandlerContext,
  ActionHandlerResult,
  ActionRollbackContext,
} from "./actionRegistry";
import { ActionRegistry } from "./actionRegistry";

function baseEvidence(ctx: ActionHandlerContext, label: string): Record<string, unknown> {
  return {
    tenant_id: ctx.tenantId,
    correlation_id: ctx.correlationId,
    label,
    params_echo: ctx.params,
  };
}

function simple(
  type: ActionType,
  options: { requiresApproval?: boolean; supportsRollback?: boolean },
  label: string,
): ActionDefinition {
  const requiresApproval = options.requiresApproval ?? ACTION_TYPES_REQUIRING_APPROVAL.has(type);
  const supportsRollback = options.supportsRollback ?? false;

  return {
    type,
    requiresApproval,
    supportsRollback,
    async execute(ctx: ActionHandlerContext): Promise<ActionHandlerResult> {
      const evidence = baseEvidence(ctx, label);
      if (ctx.dryRun) {
        return { ok: true, evidence: { ...evidence, dry_run: true, would_apply: true } };
      }
      const baseResult: ActionHandlerResult = {
        ok: true,
        evidence: { ...evidence, applied: true, simulated: true },
      };
      if (supportsRollback) {
        return {
          ...baseResult,
          rollback_token: `rb-${type}-${ctx.correlationId}`,
        };
      }
      return baseResult;
    },
    ...(supportsRollback
      ? {
          async rollback(ctx: ActionRollbackContext): Promise<ActionHandlerResult> {
            return {
              ok: true,
              evidence: {
                ...baseEvidence(ctx, `${label} rollback`),
                rollback_token: ctx.rollback_token,
                rolled_back: true,
                simulated: true,
              },
            };
          },
        }
      : {}),
  };
}

function isolateEndpoint(): ActionDefinition {
  const type = "isolate_endpoint" as const;
  return {
    type,
    requiresApproval: true,
    supportsRollback: true,
    async execute(ctx: ActionHandlerContext): Promise<ActionHandlerResult> {
      const evidence = baseEvidence(ctx, "isolate_endpoint");
      if (ctx.dryRun) {
        return { ok: true, evidence: { ...evidence, dry_run: true, would_isolate: true } };
      }
      return {
        ok: true,
        evidence: { ...evidence, isolated: true, simulated: true },
        rollback_token: `rb-${type}-${ctx.correlationId}`,
      };
    },
    async rollback(ctx: ActionRollbackContext): Promise<ActionHandlerResult> {
      return {
        ok: true,
        evidence: {
          ...baseEvidence(ctx, "isolate_endpoint rollback"),
          rollback_token: ctx.rollback_token,
          isolation_released: true,
          simulated: true,
        },
      };
    },
  };
}

/** Registers deterministic mock handlers for every {@link ActionType} (safe for labs). */
export function createDefaultActionRegistry(): ActionRegistry {
  const registry = new ActionRegistry();

  registry.register(simple("create_ticket", { requiresApproval: false }, "create_ticket"));
  registry.register(simple("send_alert", { requiresApproval: false }, "send_alert"));
  registry.register(isolateEndpoint());
  registry.register(simple("disable_user", { requiresApproval: true }, "disable_user"));
  registry.register(simple("revoke_session", { requiresApproval: true }, "revoke_session"));
  registry.register(simple("rotate_secret", { requiresApproval: true }, "rotate_secret"));
  registry.register(
    simple("block_ip", { requiresApproval: true, supportsRollback: true }, "block_ip"),
  );
  registry.register(
    simple("close_port", { requiresApproval: true, supportsRollback: true }, "close_port"),
  );
  registry.register(
    simple("deploy_policy", { requiresApproval: true, supportsRollback: true }, "deploy_policy"),
  );
  registry.register(
    simple("rollback_policy", { requiresApproval: true, supportsRollback: false }, "rollback_policy"),
  );
  registry.register(simple("trigger_rescan", { requiresApproval: false }, "trigger_rescan"));
  registry.register(
    simple("request_human_approval", { requiresApproval: false }, "request_human_approval"),
  );

  return registry;
}
