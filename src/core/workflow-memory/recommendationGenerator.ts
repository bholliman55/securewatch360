import { randomUUID } from "node:crypto";
import type { DetectedPattern, LearningRecommendation } from "./workflowMemory.schema";
import { learningRecommendationSchema } from "./workflowMemory.schema";

/**
 * Turns detected patterns into human-readable recommendations — never applies rule changes.
 */
export function recommendationFromPattern(pattern: DetectedPattern): LearningRecommendation | null {
  if (pattern.kind === "false_positive_cluster") {
    return learningRecommendationSchema.parse({
      recommendation_id: randomUUID(),
      tenant_id: pattern.tenant_id,
      pattern_id: pattern.pattern_id,
      title: "Consider tuning suppression or correlation for repeated benign signals",
      narrative:
        `The finding signature "${pattern.subject_key}" has appeared ${pattern.occurrences} times as likely noise in this tenant. ` +
        `Recommend reviewing deduplication, severity mapping, or an analyst-approved suppression rule — **do not auto-suppress**. ` +
        `Route through learning approval if policy bindings should change.`,
      recommendation_kind: "suppress_false_positive_candidate",
      auto_apply_forbidden: true,
      created_at: new Date().toISOString(),
    });
  }

  if (pattern.kind === "remediation_failure_cluster") {
    return learningRecommendationSchema.parse({
      recommendation_id: randomUUID(),
      tenant_id: pattern.tenant_id,
      pattern_id: pattern.pattern_id,
      title: "Remediation playbook may need adjustment",
      narrative:
        `Repeated remediation failures for "${pattern.subject_key}" (${pattern.occurrences} weighted hits). ` +
        `Suggest validating connectors, credentials, and guardrails before retry storms consume capacity.`,
      recommendation_kind: "adjust_remediation_playbook",
      auto_apply_forbidden: true,
      created_at: new Date().toISOString(),
    });
  }

  if (pattern.kind === "policy_drift_recurring") {
    return learningRecommendationSchema.parse({
      recommendation_id: randomUUID(),
      tenant_id: pattern.tenant_id,
      pattern_id: pattern.pattern_id,
      title: "Recurring policy drift — schedule binding review",
      narrative:
        `Control or deployment drift around "${pattern.subject_key}" recurred ${pattern.occurrences} times. ` +
        `Recommend reconciling policy bundles with deployed posture under change management — **no silent deploy**.`,
      recommendation_kind: "tighten_policy_binding",
      auto_apply_forbidden: true,
      created_at: new Date().toISOString(),
    });
  }

  if (pattern.kind === "vulnerable_asset_recurring") {
    return learningRecommendationSchema.parse({
      recommendation_id: randomUUID(),
      tenant_id: pattern.tenant_id,
      pattern_id: pattern.pattern_id,
      title: "Prioritize hardening for chronically exposed asset pattern",
      narrative:
        `Asset cluster "${pattern.subject_key}" shows recurring vulnerability cycles (${pattern.occurrences}). ` +
        `Recommend ownership review, patching SLAs, and compensating controls.`,
      recommendation_kind: "prioritize_asset_hardening",
      auto_apply_forbidden: true,
      created_at: new Date().toISOString(),
    });
  }

  return null;
}

export function recommendationsFromPatterns(patterns: DetectedPattern[]): LearningRecommendation[] {
  const out: LearningRecommendation[] = [];
  for (const p of patterns) {
    const r = recommendationFromPattern(p);
    if (r) out.push(r);
  }
  return out;
}
