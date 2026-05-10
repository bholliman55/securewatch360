import { randomUUID } from "node:crypto";
import type { ApprovalCard, ApprovalEvidenceRef, ApprovalRollback } from "./approvalCard.schema";
import { approvalCardSchema } from "./approvalCard.schema";

export type ApprovalCardInput = {
  tenant_id: string;
  incident_id: string;
  approval_request_id: string;
  title: string;
  requested_action_plain_english: string;
  risk_level: ApprovalCard["risk_level"];
  risk_rationale: string;
  evidence: ApprovalEvidenceRef[];
  rollback: ApprovalRollback;
  expires_at?: string;
};

/**
 * Builds a validated approval card — requires human-readable risk narrative and at least one evidence pointer (no raw logs).
 */
export function buildApprovalCard(input: ApprovalCardInput): ApprovalCard {
  return approvalCardSchema.parse({
    card_id: randomUUID(),
    tenant_id: input.tenant_id,
    incident_id: input.incident_id,
    approval_request_id: input.approval_request_id,
    title: input.title,
    requested_action_plain_english: input.requested_action_plain_english,
    risk_level: input.risk_level,
    risk_rationale: input.risk_rationale,
    evidence: input.evidence,
    rollback: input.rollback,
    expires_at: input.expires_at,
  });
}
