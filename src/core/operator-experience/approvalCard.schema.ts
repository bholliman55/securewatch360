/**
 * Approval queue cards — risk, evidence pointers, rollback posture (no secret values).
 */

import { z } from "zod";

export const approvalRiskHintSchema = z.enum(["low", "medium", "high", "critical"]);

export const approvalEvidenceRefSchema = z.object({
  label: z.string().min(1).max(256),
  /** Opaque evidence record id or bundle URL — never paste secrets. */
  evidence_reference: z.string().min(1).max(2048),
  kind: z.enum(["finding", "ticket", "scan_run", "policy_decision", "export_bundle", "other"]),
});

export type ApprovalEvidenceRef = z.infer<typeof approvalEvidenceRefSchema>;

export const approvalRollbackSchema = z.object({
  /** Human-readable rollback path (dry-run vs live, rollback token id, etc.). */
  summary: z.string().min(1).max(4000),
  rollback_available: z.boolean(),
  rollback_reference: z.string().max(512).optional(),
  estimated_blast_radius_if_denied: z.string().max(2000).optional(),
});

export type ApprovalRollback = z.infer<typeof approvalRollbackSchema>;

export const approvalCardSchema = z.object({
  card_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1).max(256),
  approval_request_id: z.string().min(1).max(256),
  title: z.string().min(1).max(500),
  requested_action_plain_english: z.string().min(1).max(4000),
  risk_level: approvalRiskHintSchema,
  risk_rationale: z.string().min(1).max(4000),
  evidence: z.array(approvalEvidenceRefSchema).min(1).max(24),
  rollback: approvalRollbackSchema,
  expires_at: z.string().datetime().optional(),
});

export type ApprovalCard = z.infer<typeof approvalCardSchema>;
