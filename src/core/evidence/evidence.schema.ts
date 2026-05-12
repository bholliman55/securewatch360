/**
 * Evidence artifacts for incidents, audits, insurance, and compliance — immutable-friendly shapes with hashes.
 */

import { z } from "zod";

export const EVIDENCE_TYPES = [
  "raw_event",
  "normalized_event",
  "screenshot_reference",
  "endpoint_snapshot",
  "policy_decision",
  "remediation_action",
  "approval_record",
  "ticket_record",
  "report_artifact",
  "before_after_state",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** Shared fields required on every evidence row (audit / insurance baseline). */
export const evidenceCommonSchema = z.object({
  evidence_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1).max(256),
  source: z.string().min(1).max(512),
  collected_at: z.string().datetime(),
  /** Content-addressed or vendor-computed integrity tag (e.g. sha256:...). */
  hash: z.string().min(1).max(512),
  /** Opaque pointer to raw bytes (object store key, blob id, PSA attachment id). */
  raw_reference: z.string().min(1).max(2048),
  summary: z.string().min(1).max(32000),
});

export type EvidenceCommon = z.infer<typeof evidenceCommonSchema>;

export const rawEventEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("raw_event"),
  event_name: z.string().max(512).optional(),
  raw_payload_ref: z.string().max(2048).optional(),
});

export const normalizedEventEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("normalized_event"),
  normalizer_version: z.string().max(64).optional(),
  canonical_event_type: z.string().max(256).optional(),
});

export const screenshotReferenceEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("screenshot_reference"),
  capture_url: z.string().url().optional(),
  viewport_label: z.string().max(256).optional(),
});

export const endpointSnapshotEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("endpoint_snapshot"),
  hostname: z.string().max(512).optional(),
  snapshot_format: z.enum(["json", "binary_ref"]).optional(),
});

export const policyDecisionEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("policy_decision"),
  decision_id: z.string().max(256).optional(),
  policy_engine: z.string().max(128).optional(),
});

export const remediationActionEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("remediation_action"),
  remediation_action_id: z.string().max(256).optional(),
  action_kind: z.string().max(128).optional(),
});

export const approvalRecordEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("approval_record"),
  approval_id: z.string().max(256).optional(),
  approver: z.string().max(512).optional(),
});

export const ticketRecordEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("ticket_record"),
  external_ticket_id: z.string().max(256).optional(),
  provider: z.string().max(128).optional(),
});

export const reportArtifactEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("report_artifact"),
  report_kind: z.string().max(128).optional(),
  format: z.enum(["pdf", "html", "json", "markdown", "other"]).optional(),
});

const jsonLikeRecord = z.record(z.string(), z.unknown());

export const beforeAfterStateEvidenceSchema = evidenceCommonSchema.extend({
  evidence_type: z.literal("before_after_state"),
  /** Serialized posture or config immediately prior to remediation. */
  before_state: jsonLikeRecord,
  /** Serialized posture or config after remediation (or failed attempt). */
  after_state: jsonLikeRecord,
  remediation_action_id: z.string().max(256).optional(),
});

export const evidenceItemSchema = z.discriminatedUnion("evidence_type", [
  rawEventEvidenceSchema,
  normalizedEventEvidenceSchema,
  screenshotReferenceEvidenceSchema,
  endpointSnapshotEvidenceSchema,
  policyDecisionEvidenceSchema,
  remediationActionEvidenceSchema,
  approvalRecordEvidenceSchema,
  ticketRecordEvidenceSchema,
  reportArtifactEvidenceSchema,
  beforeAfterStateEvidenceSchema,
]);

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const custodyActionSchema = z.enum([
  "created",
  "sealed",
  "exported",
  "accessed",
  "retention_updated",
  "transferred",
]);

export type CustodyAction = z.infer<typeof custodyActionSchema>;

export const custodyEventSchema = z.object({
  custody_id: z.string().uuid(),
  evidence_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  recorded_at: z.string().datetime(),
  actor: z.string().min(1).max(512),
  action: custodyActionSchema,
  notes: z.string().max(8000).optional(),
});

export type CustodyEvent = z.infer<typeof custodyEventSchema>;

export const evidencePackageManifestSchema = z.object({
  package_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1),
  generated_at: z.string().datetime(),
  evidence_count: z.number().int().nonnegative(),
  custody_event_count: z.number().int().nonnegative(),
  /** sha256 over canonical JSON of ordered evidence_id list + custody_id list */
  manifest_hash: z.string().min(1).max(128),
});

export type EvidencePackageManifest = z.infer<typeof evidencePackageManifestSchema>;
