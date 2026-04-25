/**
 * SecureWatch360 v4 risk exception models.
 */

export const RISK_EXCEPTION_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "expired",
  "revoked",
] as const;

export type RiskExceptionStatus = (typeof RISK_EXCEPTION_STATUSES)[number];

export type RiskException = {
  id: string;
  tenant_id: string;
  finding_id: string;
  requested_by_user_id: string | null;
  approved_by_user_id: string | null;
  status: RiskExceptionStatus;
  justification: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
