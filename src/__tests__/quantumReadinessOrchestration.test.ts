import { describe, it, expect } from "vitest";
import { runQuantumReadinessAssessment } from "@/agents/agent6-quantum-readiness";
import { SAMPLE_RAW_FINDINGS } from "@/agents/agent6-quantum-readiness/samplePayloads";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("runQuantumReadinessAssessment — orchestration", () => {
  it("assigns UUIDs on every inventory row for downstream persistence/FKs", async () => {
    const out = await runQuantumReadinessAssessment({
      clientId: TENANT_ID,
      scanFindings: SAMPLE_RAW_FINDINGS.slice(0, 1),
      options: { enableOpa: false },
    });

    expect(out.inventory.length).toBeGreaterThan(0);
    for (const row of out.inventory) {
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
    expect(out.meta.opaPolicyResultsCount).toBe(0);
  });

  it("returns empty inventory when no sources provided", async () => {
    const out = await runQuantumReadinessAssessment({
      clientId: TENANT_ID,
      options: { enableOpa: false },
    });
    expect(out.inventory).toEqual([]);
    expect(out.policyResults.length).toBe(0);
  });
});
