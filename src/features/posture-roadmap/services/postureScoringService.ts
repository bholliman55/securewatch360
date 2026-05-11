/**
 * SecureWatch360 — Posture Roadmap feature-layer scoring service.
 *
 * Re-exports the full scoring engine from src/lib/postureScoringService and
 * adds generatePostureAssessment(), which orchestrates a complete assessment
 * from raw input in a single call.
 */

export {
  calculateOverallPostureScore,
  calculateFrameworkReadiness,
  generatePostureGaps,
  generateRoadmapItems,
  calculateDistanceToTarget,
} from "@/lib/postureScoringService";

export type {
  PostureScoringInput,
  PostureScoringResult,
  FrameworkReadinessResult,
  GeneratedGap,
  GeneratedRoadmapItem,
  DistanceToTargetResult,
} from "@/lib/postureScoringService";

import {
  calculateOverallPostureScore,
  calculateFrameworkReadiness,
  generatePostureGaps,
  generateRoadmapItems,
  calculateDistanceToTarget,
} from "@/lib/postureScoringService";
import type { PostureScoringInput } from "@/lib/postureScoringService";
import { FRAMEWORK_TYPES } from "@/features/posture-roadmap/types/postureTypes";
import type { PostureAssessmentResult } from "@/features/posture-roadmap/types/postureTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(
  overallScore: number,
  maturityLabel: string,
  targetFramework: string,
  readinessPercentage: number,
  criticalGaps: number,
  highGaps: number,
  isEstimated: boolean
): string {
  const estimatedNote = isEstimated ? " (based on estimated data)" : "";
  const gapNote =
    criticalGaps > 0
      ? ` There are ${criticalGaps} critical and ${highGaps} high-priority gap${highGaps !== 1 ? "s" : ""} requiring immediate attention.`
      : highGaps > 0
        ? ` There are ${highGaps} high-priority gap${highGaps !== 1 ? "s" : ""} to address.`
        : " No critical or high gaps detected.";

  return (
    `Overall posture score is ${overallScore}/100 (${maturityLabel})${estimatedNote}. ` +
    `${targetFramework} readiness is ${readinessPercentage}%.` +
    gapNote
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrates a full posture assessment from raw scoring input.
 *
 * Calculates overall score, per-framework readiness for all six supported
 * frameworks, gaps against the target framework, prioritized roadmap items,
 * and distance to the target score — all in one deterministic pass.
 *
 * Missing / zero values in input are handled gracefully; results are flagged
 * as estimated when input.isEstimated is true or when critical fields are absent.
 */
export function generatePostureAssessment(
  input: PostureScoringInput,
  targetFramework: string,
  options?: { clientId?: string; assessmentName?: string }
): PostureAssessmentResult {
  const isEstimated =
    input.isEstimated ??
    (input.totalAssets === 0 && input.totalUsers === 0);

  const enrichedInput: PostureScoringInput = { ...input, isEstimated };

  const scoringResult = calculateOverallPostureScore(enrichedInput);

  const frameworkReadiness = FRAMEWORK_TYPES.map((fw) =>
    calculateFrameworkReadiness(enrichedInput, fw)
  );

  const normalizedTarget = targetFramework.toUpperCase();
  const targetReadiness =
    frameworkReadiness.find((r) => r.framework === normalizedTarget) ??
    calculateFrameworkReadiness(enrichedInput, normalizedTarget);

  const gaps = generatePostureGaps(enrichedInput, normalizedTarget);
  const roadmapItems = generateRoadmapItems(gaps);

  const distanceToTarget = calculateDistanceToTarget(
    scoringResult.overallScore,
    targetReadiness.targetScore
  );

  const criticalGaps = gaps.filter((g) => g.severity === "critical").length;
  const highGaps = gaps.filter((g) => g.severity === "high").length;

  const summary = buildSummary(
    scoringResult.overallScore,
    scoringResult.maturityLabel,
    normalizedTarget,
    targetReadiness.readinessPercent,
    criticalGaps,
    highGaps,
    isEstimated
  );

  return {
    tenantId: input.tenantId,
    ...(options?.clientId ? { clientId: options.clientId } : {}),
    ...(options?.assessmentName ? { assessmentName: options.assessmentName } : {}),
    overallScore: scoringResult.overallScore,
    maturityLabel: scoringResult.maturityLabel,
    targetFramework: normalizedTarget,
    targetScore: targetReadiness.targetScore,
    readinessPercentage: targetReadiness.readinessPercent,
    summary,
    isEstimated,
    categoryScores: scoringResult.categoryScores,
    frameworkReadiness,
    gaps,
    roadmapItems,
    distanceToTarget,
  };
}
