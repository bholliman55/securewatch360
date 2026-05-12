/**
 * Post-remediation validation — explicit checks before closing the loop on incidents.
 */

import { z } from "zod";
import { ACTION_TYPES, type ActionType } from "../actions/action.schema";

export const VALIDATION_TYPES = [
  "rescan_asset",
  "verify_policy_state",
  "verify_endpoint_isolation",
  "verify_account_disabled",
  "verify_port_closed",
  "verify_patch_installed",
  "verify_ticket_updated",
  "verify_alert_resolved",
] as const;

export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const validationStepSchema = z.object({
  step_id: z.string().uuid().optional(),
  order: z.number().int().nonnegative(),
  validation_type: z.enum(VALIDATION_TYPES),
  params: z.record(z.string(), z.unknown()).default({}),
});

export type ValidationStep = z.infer<typeof validationStepSchema>;

export const remediationValidationPlanSchema = z.object({
  plan_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1).max(256),
  remediation_action_id: z.string().min(1).max(256),
  action_type: z.enum(ACTION_TYPES),
  steps: z.array(validationStepSchema).min(1),
  on_failure: z.enum(["reopen_incident", "escalate_incident"]),
});

export type RemediationValidationPlan = z.infer<typeof remediationValidationPlanSchema>;

export const validationRunContextSchema = z.object({
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1).max(256),
  remediation_action_id: z.string().min(1).max(256),
  dry_run: z.boolean().default(false),
  /** When true, validators must not mutate production systems and may use fixtures. */
  simulation_mode: z.boolean().default(false),
});

export type ValidationRunContext = z.infer<typeof validationRunContextSchema>;

export const validationStepResultSchema = z.object({
  step_id: z.string().uuid(),
  validation_type: z.enum(VALIDATION_TYPES),
  ok: z.boolean(),
  message: z.string().max(8000),
  evidence_ids: z.array(z.string().min(1)).default([]),
  simulated: z.boolean().default(false),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
});

export type ValidationStepResult = z.infer<typeof validationStepResultSchema>;

export const validationRunOutcomeSchema = z.enum(["success", "failed", "partial_skipped"]);
export type ValidationRunOutcome = z.infer<typeof validationRunOutcomeSchema>;

export const validationRunRecordSchema = z.object({
  run_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  context: validationRunContextSchema,
  step_results: z.array(validationStepResultSchema),
  outcome: validationRunOutcomeSchema,
  /** When outcome is failed, caller should reopen or escalate per plan. */
  incident_action: z.enum(["none", "reopen_incident", "escalate_incident"]),
  report_summary: z.string().max(32000),
  evidence_appendix: z.array(z.string().min(1)).default([]),
});

export type ValidationRunRecord = z.infer<typeof validationRunRecordSchema>;

/** Suggested default checks per remediation action — callers may override with custom plans. */
export function defaultValidationStepsForAction(actionType: ActionType): Omit<ValidationStep, "step_id">[] {
  const base = (order: number, validation_type: ValidationType, params: Record<string, unknown> = {}) => ({
    order,
    validation_type,
    params,
  });

  switch (actionType) {
    case "isolate_endpoint":
      return [base(0, "verify_endpoint_isolation"), base(1, "rescan_asset")];
    case "disable_user":
      return [base(0, "verify_account_disabled"), base(1, "verify_ticket_updated")];
    case "close_port":
      return [base(0, "verify_port_closed"), base(1, "rescan_asset")];
    case "deploy_policy":
    case "rollback_policy":
      return [base(0, "verify_policy_state"), base(1, "verify_ticket_updated")];
    case "block_ip":
      return [base(0, "verify_alert_resolved"), base(1, "rescan_asset")];
    case "rotate_secret":
      return [
        base(0, "verify_patch_installed", { scope: "secret_rotation" }),
        base(1, "verify_ticket_updated"),
        base(2, "verify_alert_resolved"),
      ];
    case "trigger_rescan":
      return [base(0, "rescan_asset")];
    case "create_ticket":
    case "send_alert":
    case "request_human_approval":
      return [base(0, "verify_ticket_updated")];
    case "revoke_session":
      return [base(0, "verify_account_disabled"), base(1, "verify_alert_resolved")];
  }
}
