/**
 * Identity Security Agent — vendor-neutral contracts for IdP log analysis.
 */

export const IDENTITY_LOG_SOURCES = [
  "microsoft_entra",
  "google_workspace",
  "okta",
  "duo",
  "simulated",
] as const;

export type IdentityLogSource = (typeof IDENTITY_LOG_SOURCES)[number];

export const IDENTITY_SIGNAL_TYPES = [
  "impossible_travel",
  "mfa_fatigue",
  "risky_sign_in",
  "dormant_admin_account",
  "privilege_escalation",
  "suspicious_oauth_grant",
  "service_account_abuse",
  "excessive_permissions",
  "new_admin_outside_policy",
  "conditional_access_drift",
] as const;

export type IdentitySignalType = (typeof IDENTITY_SIGNAL_TYPES)[number];

export type IdentityApprovalRequirement = "none" | "analyst" | "security_admin";

/** Canonical row after source-specific normalization (no vendor field names in consumers). */
export interface NormalizedIdentityEvent {
  tenant_id: string;
  source: IdentityLogSource;
  event_id: string;
  observed_at: string;
  user_principal?: string;
  ip_address?: string;
  geo_country?: string;
  geo_city?: string;
  user_agent?: string;
  event_category: string;
  outcome?: string;
  mfa_required?: boolean;
  mfa_satisfied?: boolean;
  roles?: string[];
  application_id?: string;
  application_name?: string;
  is_admin_action?: boolean;
  is_policy_change?: boolean;
  is_oauth_consent?: boolean;
  is_service_principal?: boolean;
  risk_hints?: string[];
  raw: Record<string, unknown>;
}

export interface IdentityFinding {
  id: string;
  tenant_id: string;
  signal_type: IdentitySignalType;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  title: string;
  description: string;
  affected_principal?: string;
  evidence_event_ids: string[];
  recommended_remediation: string;
  required_approval: IdentityApprovalRequirement;
}

export interface IdentityAgentReport {
  generated_at: string;
  tenant_id: string;
  sources_processed: IdentityLogSource[];
  events_normalized: number;
  findings: IdentityFinding[];
  risk_score_0_100: number;
  report_summary: string;
}

export interface IdentityAgentInput {
  tenant_id: string;
  raw_events: Array<{
    source: IdentityLogSource;
    payload: unknown;
  }>;
}
