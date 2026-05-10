import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WorkflowMemoryStore } from "./memoryStore";
import { detectPatternsFromMemory } from "./patternDetector";
import { recommendationsFromPatterns } from "./recommendationGenerator";
import type { MemoryTrackType, WorkflowMemoryEntry } from "./workflowMemory.schema";

const TENANT = "11111111-1111-4111-8111-111111111111";

function entry(track: MemoryTrackType, subject_key: string, weight = 1): WorkflowMemoryEntry {
  return {
    entry_id: randomUUID(),
    tenant_id: TENANT,
    track_type: track,
    recorded_at: new Date().toISOString(),
    subject_key,
    summary: `observation ${subject_key}`,
    count_weight: weight,
    metadata: {},
  };
}

describe("workflow-memory", () => {
  it("recommends false-positive suppression review after repeated benign signature", () => {
    const store = new WorkflowMemoryStore();
    for (let i = 0; i < 4; i++) {
      store.append(entry("false_positive_repeat", "finding:same-signature:svc-auth-noise"));
    }
    const patterns = detectPatternsFromMemory({
      tenant_id: TENANT,
      entries: store.listTenant(TENANT),
      config: { false_positive_threshold: 4 },
    });
    expect(patterns.some((p) => p.kind === "false_positive_cluster")).toBe(true);
    const recs = recommendationsFromPatterns(patterns);
    const fp = recs.find((r) => r.recommendation_kind === "suppress_false_positive_candidate");
    expect(fp).toBeDefined();
    expect(fp?.auto_apply_forbidden).toBe(true);
    expect(fp?.narrative.toLowerCase()).toMatch(/do not auto-suppress/);
  });

  it("detects recurring policy drift pattern", () => {
    const store = new WorkflowMemoryStore();
    for (let i = 0; i < 3; i++) {
      store.append(entry("policy_drift_repeat", "binding:pci-fw-01"));
    }
    const patterns = detectPatternsFromMemory({
      tenant_id: TENANT,
      entries: store.listTenant(TENANT),
      config: { policy_drift_threshold: 3 },
    });
    expect(patterns.some((p) => p.kind === "policy_drift_recurring")).toBe(true);
    const recs = recommendationsFromPatterns(patterns);
    expect(recs.some((r) => r.recommendation_kind === "tighten_policy_binding")).toBe(true);
  });
});
