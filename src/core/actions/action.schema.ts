/**
 * Zod schemas for the SecureWatch360 action execution layer.
 * Payloads stay generic records per action type — concrete adapters validate downstream.
 */

import { z } from "zod";

export const ACTION_TYPES = [
  "create_ticket",
  "send_alert",
  "isolate_endpoint",
  "disable_user",
  "revoke_session",
  "rotate_secret",
  "block_ip",
  "close_port",
  "deploy_policy",
  "rollback_policy",
  "trigger_rescan",
  "request_human_approval",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Actions that require a prior approval reference when not in dry_run. */
export const ACTION_TYPES_REQUIRING_APPROVAL: ReadonlySet<ActionType> = new Set([
  "isolate_endpoint",
  "disable_user",
  "revoke_session",
  "rotate_secret",
  "block_ip",
  "close_port",
  "deploy_policy",
  "rollback_policy",
]);

export function actionTypeRequiresApproval(type: ActionType): boolean {
  return ACTION_TYPES_REQUIRING_APPROVAL.has(type);
}

export const actionExecutionInputSchema = z.object({
  tenant_id: z.string().uuid(),
  type: z.enum(ACTION_TYPES),
  dry_run: z.boolean(),
  correlation_id: z.string().uuid(),
  actor_user_id: z.string().uuid().nullable().optional(),
  /** Evidence id / ticket id proving human approval for gated actions (required when not dry_run). */
  approval_reference: z.string().min(1).optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export type ActionExecutionInput = z.infer<typeof actionExecutionInputSchema>;

export const actionExecutionResultSchema = z.object({
  ok: z.boolean(),
  dry_run: z.boolean(),
  type: z.enum(ACTION_TYPES),
  correlation_id: z.string().uuid(),
  evidence: z.record(z.string(), z.unknown()),
  error: z.string().optional(),
  approval_required: z.boolean().optional(),
  rollback_token: z.string().optional(),
});

export type ActionExecutionResult = z.infer<typeof actionExecutionResultSchema>;
