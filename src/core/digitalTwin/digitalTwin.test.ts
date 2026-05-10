import { describe, expect, it } from "vitest";
import { DigitalTwinSecurityStateEngine } from "./twinEngine";
import { diffSnapshots } from "./diffEngine";
import { deriveAttackPathsFromSnapshot } from "./attackPathTracking";
import { materializeTwinWithOverlay } from "./simulationOverlay";
import { createSecurityPostureSnapshot } from "./snapshot";

const minimalTwin = (tenantId: string, seq: number) =>
  createSecurityPostureSnapshot({
    tenantId,
    sequence: seq,
    assets: [{ id: "a1", name: "Web", type: "host", tags: ["internet"] }],
    vulnerabilities: [
      {
        id: "v1",
        assetId: "a1",
        severity: "critical",
        title: "RCE",
        status: "open",
      },
    ],
    identities: [{ id: "i1", principal: "svc@corp", kind: "service_account" }],
    exposedServices: [
      {
        id: "s1",
        assetId: "a1",
        protocol: "tcp",
        port: 443,
        exposure: "internet",
      },
    ],
    policyStates: [{ policyId: "p1", name: "Gate", posture: "compliant" }],
    compliancePosture: [{ id: "compliance:SOC2", framework: "SOC2", scorePct: 88, failingControls: 2 }],
    activeIncidents: [],
    remediations: [],
  });

describe("DigitalTwinSecurityStateEngine", () => {
  it("captures snapshots and diffs", () => {
    const engine = new DigitalTwinSecurityStateEngine("tenant-1", { maxSnapshots: 10 });
    const s1 = minimalTwin("tenant-1", 1);
    engine.capture({
      assets: s1.assets,
      vulnerabilities: s1.vulnerabilities,
      identities: s1.identities,
      exposedServices: s1.exposedServices,
      policyStates: s1.policyStates,
      compliancePosture: s1.compliancePosture,
      activeIncidents: s1.activeIncidents,
      remediations: s1.remediations,
      sequence: 1,
    });

    const s2 = engine.capture({
      assets: s1.assets,
      vulnerabilities: s1.vulnerabilities.map((v) =>
        v.id === "v1" ? { ...v, status: "in_remediation" as const } : v,
      ),
      identities: s1.identities,
      exposedServices: s1.exposedServices,
      policyStates: s1.policyStates,
      compliancePosture: s1.compliancePosture,
      activeIncidents: s1.activeIncidents,
      remediations: s1.remediations,
      sequence: 2,
    });

    const d = diffSnapshots(s1, s2);
    expect(d.riskScoreDelta).toBeLessThanOrEqual(0);
    expect(d.entities.some((e) => e.entityType === "vulnerability")).toBe(true);
  });

  it("derives attack paths from exposed service + vuln", () => {
    const s = minimalTwin("t", 1);
    const paths = deriveAttackPathsFromSnapshot(s);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0]?.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("playback yields frames with diffs", () => {
    const engine = new DigitalTwinSecurityStateEngine("tenant-2");
    engine.capture({
      assets: [{ id: "a1", name: "x", type: "host" }],
      vulnerabilities: [],
      identities: [],
      exposedServices: [],
      policyStates: [],
      compliancePosture: [{ id: "compliance:NIST", framework: "NIST", scorePct: 90, failingControls: 0 }],
      activeIncidents: [],
      remediations: [],
    });
    engine.capture({
      assets: [{ id: "a1", name: "x", type: "host" }],
      vulnerabilities: [],
      identities: [],
      exposedServices: [],
      policyStates: [],
      compliancePosture: [{ id: "compliance:NIST", framework: "NIST", scorePct: 85, failingControls: 1 }],
      activeIncidents: [],
      remediations: [],
    });
    const frames = engine.playback();
    expect(frames.length).toBe(2);
    expect(frames[1]?.diffFromPrevious).not.toBeNull();
  });

  it("simulation overlay adjusts snapshot", () => {
    const base = minimalTwin("t", 1);
    const overlay = {
      overlayId: "sim-1",
      label: "extra vuln",
      additionalVulnerabilities: [
        {
          id: "v-sim",
          assetId: "a1",
          severity: "high" as const,
          title: "Simulated",
          status: "open" as const,
        },
      ],
      riskScoreAdjustment: 5,
    };
    const merged = materializeTwinWithOverlay(
      {
        tenantId: "t",
        sequence: 1,
        assets: base.assets,
        vulnerabilities: base.vulnerabilities,
        identities: base.identities,
        exposedServices: base.exposedServices,
        policyStates: base.policyStates,
        compliancePosture: base.compliancePosture,
        activeIncidents: base.activeIncidents,
        remediations: base.remediations,
      },
      overlay,
    );
    expect(merged.vulnerabilities.some((v) => v.id === "v-sim")).toBe(true);
    expect(merged.metadata?.simulation_overlay).toBeDefined();
  });
});
