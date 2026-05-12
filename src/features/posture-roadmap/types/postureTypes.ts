/**
 * SecureWatch360 — Posture Roadmap feature-layer types.
 *
 * DB row types mirror the Supabase schema from:
 *   20260510190000_posture_roadmap.sql
 *   20260510200000_posture_roadmap_extended.sql
 *   20260510210000_posture_roadmap_gap_fill.sql
 *
 * Computed/scored types are re-exported from src/lib/postureScoringService
 * and src/types/posture-roadmap so consumers can import from one place.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports from existing shared type files
// ─────────────────────────────────────────────────────────────────────────────

export type {
  RoadmapCategory,
  RoadmapPriority,
  RoadmapEffort,
  RoadmapAutomationLevel,
  RoadmapStatus,
  PostureRoadmapItem,
  PostureTargetConfig,
  FrameworkReadiness,
  TopRisk,
  PostureCurrentState,
  RequiredControl,
  PostureTargetState,
  GapItem,
  PostureRoadmapSummary,
  UpdateRoadmapItemRequest,
  RoadmapItemUpdateResult,
} from "@/types/posture-roadmap";

export {
  ROADMAP_CATEGORIES,
  ROADMAP_CATEGORY_LABELS,
  ROADMAP_PRIORITIES,
  ROADMAP_EFFORTS,
  ROADMAP_AUTOMATION_LEVELS,
  ROADMAP_STATUSES,
} from "@/types/posture-roadmap";

export type {
  PostureScoringInput,
  PostureScoringResult,
  FrameworkReadinessResult,
  GeneratedGap,
  GeneratedRoadmapItem,
  DistanceToTargetResult,
} from "@/lib/postureScoringService";

// ─────────────────────────────────────────────────────────────────────────────
// Union types matching the DB CHECK constraints
// ─────────────────────────────────────────────────────────────────────────────

export const FRAMEWORK_TYPES = [
  "CIS",
  "NIST",
  "CMMC_L1",
  "CMMC_L2",
  "HIPAA",
  "SOC2",
] as const;
export type FrameworkType = (typeof FRAMEWORK_TYPES)[number];

export const GAP_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type GapSeverity = (typeof GAP_SEVERITIES)[number];

/** Matches posture_roadmap_action_items.automation_status CHECK constraint. */
export const AUTOMATION_STATUSES = [
  "available_now",
  "planned",
  "manual_only",
] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

/** Matches posture_roadmap_action_items.roadmap_bucket CHECK constraint. */
export const ROADMAP_BUCKETS = [
  "fix_first",
  "next_30_days",
  "next_60_days",
  "next_90_days",
] as const;
export type RoadmapBucket = (typeof ROADMAP_BUCKETS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// DB row types — posture_assessments
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureAssessment {
  id: string;
  tenant_id: string;
  client_id: string | null;
  assessment_name: string | null;
  overall_score: number | null;
  maturity_level: string | null;
  target_framework: string | null;
  target_score: number | null;
  readiness_percentage: number | null;
  summary: string | null;
  is_estimated: boolean;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types — framework_readiness_scores
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameworkReadinessScore {
  id: string;
  assessment_id: string;
  framework: string;
  readiness_percentage: number;
  current_score: number | null;
  target_score: number | null;
  status: "ready" | "approaching" | "gap" | null;
  top_gap: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types — posture_gaps
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureGap {
  id: string;
  assessment_id: string;
  category: string;
  framework: string;
  control_id: string | null;
  control_name: string | null;
  current_state: string | null;
  desired_state: string | null;
  gap_description: string | null;
  severity: GapSeverity | null;
  evidence_source: string | null;
  related_asset_id: string | null;
  related_finding_id: string | null;
  is_estimated: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types — posture_roadmap_action_items (assessment-scoped)
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureRoadmapActionItem {
  id: string;
  assessment_id: string;
  title: string;
  category: string;
  framework: string;
  priority: GapSeverity | null;
  estimated_effort: "low" | "medium" | "high" | null;
  estimated_impact_score: number | null;
  current_state: string | null;
  desired_state: string | null;
  recommended_action: string | null;
  automation_status: AutomationStatus | null;
  securewatch_agent: string | null;
  status: "not_started" | "in_progress" | "completed" | "deferred";
  roadmap_bucket: RoadmapBucket | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types — posture_score_history
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureScoreHistory {
  id: string;
  tenant_id: string;
  client_id: string | null;
  assessment_id: string | null;
  overall_score: number | null;
  cis_v8_score: number | null;
  nist_csf_score: number | null;
  cmmc_l1_score: number | null;
  cmmc_l2_score: number | null;
  hipaa_score: number | null;
  soc2_score: number | null;
  recorded_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate result type returned by generatePostureAssessment()
// ─────────────────────────────────────────────────────────────────────────────

import type { GeneratedGap, GeneratedRoadmapItem, FrameworkReadinessResult, DistanceToTargetResult } from "@/lib/postureScoringService";

export interface PostureAssessmentResult {
  tenantId: string;
  clientId?: string;
  assessmentName?: string;
  overallScore: number;
  maturityLabel: string;
  targetFramework: string;
  targetScore: number;
  readinessPercentage: number;
  summary: string;
  isEstimated: boolean;
  categoryScores: Record<string, number>;
  frameworkReadiness: FrameworkReadinessResult[];
  gaps: GeneratedGap[];
  roadmapItems: GeneratedRoadmapItem[];
  distanceToTarget: DistanceToTargetResult;
}
