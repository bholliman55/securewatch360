import { randomUUID } from "node:crypto";
import type { DetectedPattern, WorkflowMemoryEntry } from "./workflowMemory.schema";
import { detectedPatternSchema } from "./workflowMemory.schema";

export type PatternDetectorConfig = {
  /** Minimum weighted occurrences to emit a pattern. */
  false_positive_threshold: number;
  remediation_failure_threshold: number;
  policy_drift_threshold: number;
  vulnerable_asset_threshold: number;
};

const DEFAULT_CONFIG: PatternDetectorConfig = {
  false_positive_threshold: 4,
  remediation_failure_threshold: 3,
  policy_drift_threshold: 3,
  vulnerable_asset_threshold: 5,
};

/**
 * Scans tenant memory rows and emits structural patterns — does not change policies.
 */
export function detectPatternsFromMemory(args: {
  tenant_id: string;
  entries: WorkflowMemoryEntry[];
  config?: Partial<PatternDetectorConfig>;
  now_iso?: string;
}): DetectedPattern[] {
  const cfg = { ...DEFAULT_CONFIG, ...args.config };
  const now = args.now_iso ?? new Date().toISOString();
  const tenant_id = args.tenant_id;
  const patterns: DetectedPattern[] = [];

  const byTrack = (t: WorkflowMemoryEntry["track_type"]) =>
    args.entries.filter((e) => e.tenant_id === tenant_id && e.track_type === t);

  const aggregateKeys = (rows: WorkflowMemoryEntry[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.subject_key, (m.get(r.subject_key) ?? 0) + r.count_weight);
    }
    return m;
  };

  const fp = aggregateKeys(byTrack("false_positive_repeat"));
  for (const [subject_key, occurrences] of fp) {
    if (occurrences >= cfg.false_positive_threshold) {
      patterns.push(
        detectedPatternSchema.parse({
          pattern_id: randomUUID(),
          tenant_id,
          kind: "false_positive_cluster",
          subject_key,
          occurrences: Math.ceil(occurrences),
          window_description: "Rolling observation window from workflow memory",
          confidence_0_1: Math.min(1, 0.35 + occurrences * 0.08),
          detected_at: now,
        }),
      );
    }
  }

  const rf = aggregateKeys(byTrack("remediation_failure_repeat"));
  for (const [subject_key, occurrences] of rf) {
    if (occurrences >= cfg.remediation_failure_threshold) {
      patterns.push(
        detectedPatternSchema.parse({
          pattern_id: randomUUID(),
          tenant_id,
          kind: "remediation_failure_cluster",
          subject_key,
          occurrences: Math.ceil(occurrences),
          window_description: "Remediation outcomes aggregated per subject",
          confidence_0_1: Math.min(1, 0.4 + occurrences * 0.1),
          detected_at: now,
        }),
      );
    }
  }

  const drift = aggregateKeys(byTrack("policy_drift_repeat"));
  for (const [subject_key, occurrences] of drift) {
    if (occurrences >= cfg.policy_drift_threshold) {
      patterns.push(
        detectedPatternSchema.parse({
          pattern_id: randomUUID(),
          tenant_id,
          kind: "policy_drift_recurring",
          subject_key,
          occurrences: Math.ceil(occurrences),
          window_description: "Policy drift signals recurring for control / binding",
          confidence_0_1: Math.min(1, 0.45 + occurrences * 0.12),
          detected_at: now,
        }),
      );
    }
  }

  const vuln = aggregateKeys(byTrack("vulnerable_asset_repeat"));
  for (const [subject_key, occurrences] of vuln) {
    if (occurrences >= cfg.vulnerable_asset_threshold) {
      patterns.push(
        detectedPatternSchema.parse({
          pattern_id: randomUUID(),
          tenant_id,
          kind: "vulnerable_asset_recurring",
          subject_key,
          occurrences: Math.ceil(occurrences),
          window_description: "Repeated vulnerability exposure on asset cluster",
          confidence_0_1: Math.min(1, 0.42 + occurrences * 0.06),
          detected_at: now,
        }),
      );
    }
  }

  return patterns;
}
