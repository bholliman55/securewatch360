/**
 * Lean TypeScript model suggestions for remediation action tracking.
 * Keep these in sync with DB constraints in remediation_actions migration.
 */
import type {
  ApprovalStatus,
  DecisionInputPayload,
  DecisionResultPayload,
  ExceptionStatus,
} from "@/types/decisioning";

export const REMEDIATION_ACTION_TYPES = [
  "notify",
  "ticket",
  "manual_fix",
  "auto_fix",
  "config_change",
  "isolate",
] as const;

export type RemediationActionType = (typeof REMEDIATION_ACTION_TYPES)[number];

export const REMEDIATION_ACTION_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RemediationActionStatus = (typeof REMEDIATION_ACTION_STATUSES)[number];

export const REMEDIATION_EXECUTION_STATUSES = [
  "pending",
  "approved",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RemediationExecutionStatus = (typeof REMEDIATION_EXECUTION_STATUSES)[number];

export const REMEDIATION_EXECUTION_MODES = [
  "manual",
  "semi_automatic",
  "automatic",
] as const;

export type RemediationExecutionMode = (typeof REMEDIATION_EXECUTION_MODES)[number];

export type RemediationAction = {
  id: string;
  tenant_id: string;
  finding_id: string;
  action_type: RemediationActionType;
  // Legacy planning/approval lifecycle (kept for compatibility).
  action_status: RemediationActionStatus;
  // v4 execution lifecycle: tracks real execution state.
  execution_status: RemediationExecutionStatus;
  execution_mode: RemediationExecutionMode;
  execution_payload: Record<string, unknown>;
  execution_result: Record<string, unknown>;
  assigned_to_user_id: string | null;
  notes: string | null;
  decision_input: DecisionInputPayload;
  decision_result: DecisionResultPayload;
  approval_status: ApprovalStatus;
  exception_status: ExceptionStatus;
  executed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};
