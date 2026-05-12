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

  it("propagates agentType into the agent_type column", () => {
    const findings = normalizeFindings({
      tenantId: "tenant-2",
      scanRunId: "scan-run-2",
      scanTargetId: "scan-target-2",
      agentType: "web",
      source: "zap",
      assetType: "url",
      exposure: "external",
      rawFindings: [
        {
          severity: "medium",
          category: "xss",
          title: "Reflected XSS",
          description: "Input reflected without encoding.",
          evidence: { url: "https://example.com/search?q=<script>" },
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tenant_id: "tenant-2",
      scan_run_id: "scan-run-2",
      scan_id: "scan-run-2",
      scan_result_id: "scan-run-2",
      scan_target_id: "scan-target-2",
      agent_type: "web",
      severity: "medium",
      status: "open",
    });
  });

  it("sets agent_type to null when agentType is not provided", () => {
    const findings = normalizeFindings({
      tenantId: "tenant-3",
      scanRunId: "scan-run-3",
      scanTargetId: null,
      source: "mock",
      assetType: "ip",
      exposure: "internal",
      rawFindings: [
        {
          severity: "low",
          category: "info",
          title: "Open port",
          description: "Port 8080 is open.",
          evidence: { port: 8080 },
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].agent_type).toBeNull();
    expect(findings[0].scan_target_id).toBeNull();
  });

  it("normalizes unknown severity to medium", () => {
    const findings = normalizeFindings({
      tenantId: "tenant-4",
      scanRunId: "scan-run-4",
      agentType: "network",
      source: "nmap",
      assetType: "hostname",
      exposure: "internal",
      rawFindings: [
        {
          severity: "UNKNOWN_LEVEL",
          category: "recon",
          title: "Host discovery",
          description: "Host is up.",
          evidence: {},
        },
      ],
    });

    expect(findings[0].severity).toBe("medium");
    expect(findings[0].agent_type).toBe("network");
  });
});
