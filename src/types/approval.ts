/**
 * SecureWatch360 v4 approval workflow models.
 * Flexible enough for remediation, risk acceptance, and future approval paths.
 */

export const APPROVAL_TYPES = [
  "remediation_execution",
  "risk_acceptance",
  "exception_request",
  "policy_override",
  "manual_escalation",
] as const;

export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
] as const;

export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

export type ApprovalRequest = {
  id: string;
  tenant_id: string;
  finding_id: string | null;
  remediation_action_id: string | null;
  requested_by_user_id: string | null;
  assigned_approver_user_id: string | null;
  approval_type: ApprovalType;
  status: ApprovalRequestStatus;
  reason: string | null;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};
