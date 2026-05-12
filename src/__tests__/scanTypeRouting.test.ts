import { describe, expect, it } from "vitest";
import { getScanTypeRoute, normalizeScanType } from "@/lib/scanTypeRouting";

describe("scan type routing", () => {
  it("normalizes UI scan type values", () => {
    expect(normalizeScanType("standard")).toBe("standard");
    expect(normalizeScanType("external")).toBe("external");
    expect(normalizeScanType("agent1")).toBe("agent1");
    expect(normalizeScanType("agent2")).toBe("agent2");
  });

  it("normalizes aliases used by backend and voice/NL flows", () => {
    expect(normalizeScanType("external_attack_surface")).toBe("agent1");
    expect(normalizeScanType("vulnerability_analysis")).toBe("agent2");
    expect(normalizeScanType("cve-prioritization")).toBe("agent2");
    expect(normalizeScanType("standard_scan")).toBe("standard");
  });

  it("routes standard scans to the existing standard backend", () => {
    expect(getScanTypeRoute("standard")).toMatchObject({
      backendRoute: "/api/scans/request",
      runAgent1: false,
      runAgent2: false,
      agent2Mode: "none",
    });
  });

  it("routes Agent 1 to external attack surface discovery only", () => {
    expect(getScanTypeRoute("agent1")).toMatchObject({
      backendRoute: "/api/security/external-intelligence/run",
      runAgent1: true,
      runAgent2: false,
      agent2Mode: "none",
    });
  });

  it("routes Agent 2 to vulnerability analysis only", () => {
    expect(getScanTypeRoute("agent2")).toMatchObject({
      backendRoute: "/api/security/external-intelligence/run",
      runAgent1: false,
      runAgent2: true,
      agent2Mode: "vulnerability_analysis",
    });
  });
});
