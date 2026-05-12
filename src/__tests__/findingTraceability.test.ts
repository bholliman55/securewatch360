import { describe, expect, it } from "vitest";
import { normalizeFindings } from "@/scanner/analyzer";

describe("finding scan traceability", () => {
  it("preserves scan and target identifiers when normalizing scanner findings", () => {
    const findings = normalizeFindings({
      tenantId: "tenant-1",
      scanRunId: "scan-run-1",
      scanTargetId: "scan-target-1",
      source: "mock",
      assetType: "webapp",
      exposure: "external",
      rawFindings: [
        {
          severity: "high",
          category: "headers",
          title: "Missing security header",
          description: "A required browser security header is missing.",
          evidence: { header: "content-security-policy" },
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tenant_id: "tenant-1",
      scan_run_id: "scan-run-1",
      scan_id: "scan-run-1",
      scan_result_id: "scan-run-1",
      scan_target_id: "scan-target-1",
      severity: "high",
      status: "open",
    });
  });
});
