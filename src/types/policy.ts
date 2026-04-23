/**
 * SecureWatch360 v4 policy + decisioning domain models.
 * Keep aligned with SQL schema and runtime decision engine behavior.
 */

export const POLICY_TYPES = [
  "gating",
  "remediation",
  "compliance",
  "escalation",
  "monitoring",
] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const POLICY_FRAMEWORKS = [
  "soc2",
  "cmmc",
  "hipaa",
  "nist",
  "iso27001",
  "pci_dss",
  "cis",
  "gdpr",
  "fedramp",
  "ccpa",
  "cobit",
] as const;
export type PolicyFramework = (typeof POLICY_FRAMEWORKS)[number];

export const BINDING_TYPES = [
  "tenant",
  "target_type",
  "scanner",
  "control_id",
  "workflow_stage",
  "environment",
] as const;
export type BindingType = (typeof BINDING_TYPES)[number];

export const DECISION_TYPES = [
  "finding_triage",
  "remediation_approval",
  "evidence_gating",
  "scan_gating",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_RESULTS = [
  "allow",
  "deny",
  "require_approval",
  "defer",
] as const;
export type DecisionResult = (typeof DECISION_RESULTS)[number];

export const DECISION_REASONS = [
  "severity_threshold_exceeded",
  "internet_exposed_asset",
  "critical_asset_type",
  "compliance_control_required",
  "documentation_required",
  "production_change_requires_approval",
  "tenant_risk_profile_high",
  "low_severity_monitor_only",
  "remediation_required",
  "controlled_auto_remediation_allowed",
  "finding_already_resolved",
  "policy_not_matched",
] as const;
export type DecisionReason = (typeof DECISION_REASONS)[number];

export const DECISION_ACTIONS = [
  "allow",
  "monitor_only",
  "block",
  "escalate",
  "create_remediation",
  "auto_remediate",
  "request_risk_acceptance",
] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export interface Policy {
  id: string;
  tenant_id: string | null;
  name: string;
  policy_type: PolicyType;
  framework: PolicyFramework | null;
  description: string | null;
  rego_code: string;
  is_active: boolean;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyBinding {
  id: string;
  policy_id: string;
  binding_type: BindingType;
  binding_target: string;
  created_at: string;
}

export interface DecisionInput {
  tenantId: string;
  findingId?: string | null;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  category?: string | null;
  assetType?: string | null;
  targetType?: string | null;
  exposure?: "internet" | "external" | "partner" | "internal" | "isolated" | "unknown" | null;
  scannerName?: string | null;
  complianceImpact?: "none" | "low" | "moderate" | "high" | "critical" | null;
  environment?: "dev" | "staging" | "prod" | "unknown" | null;
  tenantRiskProfile?: "low" | "medium" | "high" | "critical" | null;
  currentFindingStatus?: "open" | "acknowledged" | "in_progress" | "resolved" | "risk_accepted" | null;
  metadata?: Record<string, unknown>;
}

export interface DecisionOutput {
  action: DecisionAction;
  requiresApproval: boolean;
  autoRemediationAllowed: boolean;
  riskAcceptanceAllowed: boolean;
  reasonCodes: DecisionReason[];
  matchedPolicies: Array<{
    policyId: string;
    policyName?: string;
    version?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface PolicyDecision {
  id: string;
  tenant_id: string;
  finding_id: string | null;
  remediation_action_id: string | null;
  policy_id: string | null;
  decision_type: DecisionType;
  decision_result: DecisionResult;
  reason: string | null;
  input_payload: DecisionInput;
  output_payload: DecisionOutput;
  created_at: string;
}

// Backward-compatible aliases for existing code references.
export const POLICY_BINDING_TYPES = BINDING_TYPES;
export type PolicyBindingType = BindingType;

export const POLICY_DECISION_TYPES = DECISION_TYPES;
export type PolicyDecisionType = DecisionType;

export const POLICY_DECISION_RESULTS = DECISION_RESULTS;
export type PolicyDecisionResult = DecisionResult;
