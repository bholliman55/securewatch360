import type {
  ApprovalStatus,
  DecisionInputPayload,
  DecisionResultPayload,
  ExceptionStatus,
} from "@/types/decisioning";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "risk_accepted";
export type FindingComplianceImpact = "none" | "low" | "moderate" | "high" | "critical";

export interface Finding {
  id: string;
  tenant_id: string;
  scan_run_id: string;
  severity: FindingSeverity;
  category: string | null;
  title: string;
  description: string | null;
  evidence: Record<string, unknown>;
  status: FindingStatus;
  asset_type: string;
  exposure: string;
  priority_score: number;
  assigned_to_user_id: string | null;
  notes: string | null;
  decision_input: DecisionInputPayload;
  decision_result: DecisionResultPayload;
  approval_status: ApprovalStatus;
  exception_status: ExceptionStatus;
  compliance_impact: FindingComplianceImpact;
  compliance_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
