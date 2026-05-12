/**
 * Schemas for business-aware risk assessment inputs and scored outputs.
 */

import { z } from "zod";
import { BUSINESS_CRITICALITY } from "../assets/asset.schema";

export const SEVERITY_LEVEL = ["informational", "low", "medium", "high", "critical"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVEL)[number];

export const RISK_LEVEL = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVEL)[number];

export const URGENCY = ["low", "medium", "high", "immediate"] as const;
export type Urgency = (typeof URGENCY)[number];

export const internetExposureSchema = z.enum(["none", "internal", "partner", "internet"]);
export type InternetExposure = z.infer<typeof internetExposureSchema>;

export const exploitabilitySignalsSchema = z.object({
  /** 0 = difficult / unlikely, 1 = trivial or actively exploited at scale */
  score_0_1: z.number().min(0).max(1),
  public_exploit_known: z.boolean().optional(),
  attack_complexity_low: z.boolean().optional(),
});

export type ExploitabilitySignals = z.infer<typeof exploitabilitySignalsSchema>;

export const identityExposureSignalsSchema = z.object({
  privileged_identities: z.number().int().min(0).default(0),
  breadth_identities_with_access: z.number().int().min(0).default(0),
  suspicious_session_signals: z.boolean().optional(),
});

export type IdentityExposureSignals = z.infer<typeof identityExposureSignalsSchema>;

export const complianceSignalsSchema = z.object({
  frameworks_in_scope: z.array(z.string()).default([]),
  control_gap_count: z.number().int().min(0).default(0),
  policy_drift_detected: z.boolean().optional(),
});

export type ComplianceSignals = z.infer<typeof complianceSignalsSchema>;

export const blastRadiusHintsSchema = z.object({
  downstream_asset_count: z.number().int().min(0).default(0),
  sensitive_data_proximity: z.enum(["none", "near", "direct"]).optional(),
  lateral_movement_likelihood_0_1: z.number().min(0).max(1).optional(),
});

export type BlastRadiusHints = z.infer<typeof blastRadiusHintsSchema>;

export const compensatingControlsSchema = z.object({
  /** Aggregate strength of detective / preventive controls (0–1). */
  strength_0_1: z.number().min(0).max(1),
  count: z.number().int().min(0).optional(),
});

export const remediationSignalsSchema = z.object({
  patch_or_fix_available: z.boolean(),
  eta_days: z.number().optional(),
});

export const recurrenceSignalsSchema = z.object({
  repeat_count_90d: z.number().int().min(0).default(0),
  same_root_cause: z.boolean().optional(),
});

export type RecurrenceSignals = z.infer<typeof recurrenceSignalsSchema>;

export const behavioralSignalsSchema = z.object({
  mass_encryption_like_activity: z.boolean().optional(),
  shadow_copy_deletion_attempts: z.boolean().optional(),
  suspicious_lateral_movement: z.boolean().optional(),
});

export type BehavioralSignals = z.infer<typeof behavioralSignalsSchema>;

export const businessRiskSignalsSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  finding_id: z.string().optional(),
  severity: z.enum(SEVERITY_LEVEL),
  exploitability: exploitabilitySignalsSchema,
  internet_exposure: internetExposureSchema,
  asset_criticality: z.enum(BUSINESS_CRITICALITY),
  identity_exposure: identityExposureSignalsSchema.default(() => ({
    privileged_identities: 0,
    breadth_identities_with_access: 0,
  })),
  known_exploited_vulnerability: z.boolean(),
  compliance: complianceSignalsSchema.default(() => ({
    frameworks_in_scope: [],
    control_gap_count: 0,
  })),
  blast_radius_hints: blastRadiusHintsSchema.optional(),
  compensating_controls: compensatingControlsSchema,
  remediation: remediationSignalsSchema,
  recurrence: recurrenceSignalsSchema.default(() => ({ repeat_count_90d: 0 })),
  behavioral_signals: behavioralSignalsSchema.optional(),
});

export type BusinessRiskSignals = z.infer<typeof businessRiskSignalsSchema>;

export const businessRiskResultSchema = z.object({
  risk_score: z.number().int().min(0).max(100),
  risk_level: z.enum(RISK_LEVEL),
  business_explanation: z.string(),
  recommended_action: z.string(),
  urgency: z.enum(URGENCY),
  confidence: z.number().min(0).max(1),
});

export type BusinessRiskResult = z.infer<typeof businessRiskResultSchema>;

export type RiskScoringFactor = {
  id: string;
  points: number;
  rationale: string;
};
