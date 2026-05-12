/**
 * Controlled workflow memory — observations and recommendations only; production rules stay immutable until approved.
 */

import { z } from "zod";

export const MEMORY_TRACK_TYPES = [
  "false_positive_repeat",
  "remediation_failure_repeat",
  "policy_drift_repeat",
  "vulnerable_asset_repeat",
  "tenant_baseline",
  "agent_performance",
  "simulation_history",
] as const;

export type MemoryTrackType = (typeof MEMORY_TRACK_TYPES)[number];

export const workflowMemoryEntrySchema = z.object({
  entry_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  track_type: z.enum(MEMORY_TRACK_TYPES),
  recorded_at: z.string().datetime(),
  /** Stable fingerprint for dedupe / aggregation (finding signature, asset id, rule id, etc.). */
  subject_key: z.string().min(1).max(512),
  /** Human-readable label for UI — no raw log payloads. */
  summary: z.string().min(1).max(2000),
  count_weight: z.number().positive().default(1),
  metadata: z.record(z.string(), z.string()).default({}),
});

export type WorkflowMemoryEntry = z.infer<typeof workflowMemoryEntrySchema>;

export const detectedPatternSchema = z.object({
  pattern_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  kind: z.enum([
    "false_positive_cluster",
    "remediation_failure_cluster",
    "policy_drift_recurring",
    "vulnerable_asset_recurring",
  ]),
  subject_key: z.string().min(1).max(512),
  occurrences: z.number().int().positive(),
  window_description: z.string().max(500),
  confidence_0_1: z.number().min(0).max(1),
  detected_at: z.string().datetime(),
});

export type DetectedPattern = z.infer<typeof detectedPatternSchema>;

export const learningRecommendationSchema = z.object({
  recommendation_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  pattern_id: z.string().uuid(),
  /** Recommendations never mutate rules — they reference proposed_change_id when routed to approval. */
  title: z.string().min(1).max(500),
  narrative: z.string().min(1).max(8000),
  recommendation_kind: z.enum([
    "suppress_false_positive_candidate",
    "adjust_remediation_playbook",
    "tighten_policy_binding",
    "prioritize_asset_hardening",
    "tune_agent_threshold",
    "review_simulation_coverage",
  ]),
  /** Always false for automatic application — UI/workflow must use approval queue for binding changes. */
  auto_apply_forbidden: z.literal(true),
  created_at: z.string().datetime(),
});

export type LearningRecommendation = z.infer<typeof learningRecommendationSchema>;

export const learningApprovalItemSchema = z.object({
  approval_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  recommendation_id: z.string().uuid(),
  proposed_change_summary: z.string().min(1).max(4000),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string().datetime(),
  resolved_at: z.string().datetime().optional(),
});

export type LearningApprovalItem = z.infer<typeof learningApprovalItemSchema>;
