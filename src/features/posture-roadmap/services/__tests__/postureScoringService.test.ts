/**
 * Unit tests for features/posture-roadmap/services/postureScoringService.ts
 * Focused on generatePostureAssessment(); lower-level function tests live in
 * src/lib/__tests__/postureScoringService.test.ts.
 */
import { describe, it, expect } from "vitest";
import { generatePostureAssessment } from "../postureScoringService";
import type { PostureScoringInput } from "@/lib/postureScoringService";
import { FRAMEWORK_TYPES } from "@/features/posture-roadmap/types/postureTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const fullInput: PostureScoringInput = {
  tenantId: "tenant-full",
  openFindings: [],
  totalAssets: 100,
  internetExposedAssets: 0,
  endpointsCoveredByEdr: 100,
  endpointsWithDiskEncryption: 100,
  totalUsers: 50,
  usersWithMfaEnabled: 50,
  privilegedUsersWithMfa: 10,
  totalPrivilegedUsers: 10,
  ssoEnabled: true,
  assetsWithRecentScan: 100,
  criticalVulnsOpenOver7Days: 0,
  highVulnsOpenOver30Days: 0,
  backupConfigured: true,
  backupTestedRecently: true,
  offsiteBackupEnabled: true,
  immutableBackupEnabled: true,
  centralizedLoggingEnabled: true,
  auditLoggingEnabled: true,
  siemConnected: true,
  controlsMapped: 100,
  totalControls: 100,
  evidenceArtifactsUploaded: 100,
  sspDocumented: true,
  trainingCompletionPercent: 100,
  phishingSimulationActive: true,
  lastTrainingDate: new Date().toISOString(),
  irpDocumented: true,
  irpTestedRecently: true,
  breachNotificationProcedure: true,
};

const bareInput: PostureScoringInput = {
  tenantId: "tenant-bare",
  openFindings: [
    { id: "f1", severity: "critical", category: "auth", assetType: "server", exposure: "internet", status: "open", priorityScore: 100 },
  ],
  totalAssets: 50,
  internetExposedAssets: 20,
  endpointsCoveredByEdr: 0,
  endpointsWithDiskEncryption: 0,
  totalUsers: 20,
  usersWithMfaEnabled: 0,
  privilegedUsersWithMfa: 0,
  totalPrivilegedUsers: 5,
  ssoEnabled: false,
  assetsWithRecentScan: 0,
  criticalVulnsOpenOver7Days: 3,
  highVulnsOpenOver30Days: 8,
  backupConfigured: false,
  backupTestedRecently: false,
  offsiteBackupEnabled: false,
  immutableBackupEnabled: false,
  centralizedLoggingEnabled: false,
  auditLoggingEnabled: false,
  siemConnected: false,
  controlsMapped: 0,
  totalControls: 100,
  evidenceArtifactsUploaded: 0,
  sspDocumented: false,
  trainingCompletionPercent: 0,
  phishingSimulationActive: false,
  lastTrainingDate: null,
  irpDocumented: false,
  irpTestedRecently: false,
  breachNotificationProcedure: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment — shape and completeness
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureAssessment — result shape", () => {
  it("returns all required top-level fields", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(result).toHaveProperty("tenantId", fullInput.tenantId);
    expect(result).toHaveProperty("overallScore");
    expect(result).toHaveProperty("maturityLabel");
    expect(result).toHaveProperty("targetFramework");
    expect(result).toHaveProperty("targetScore");
    expect(result).toHaveProperty("readinessPercentage");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("isEstimated");
    expect(result).toHaveProperty("categoryScores");
    expect(result).toHaveProperty("frameworkReadiness");
    expect(result).toHaveProperty("gaps");
    expect(result).toHaveProperty("roadmapItems");
    expect(result).toHaveProperty("distanceToTarget");
  });

  it("frameworkReadiness contains an entry for every supported framework", () => {
    const result = generatePostureAssessment(fullInput, "NIST");
    const returnedFrameworks = result.frameworkReadiness.map((r) => r.framework);
    for (const fw of FRAMEWORK_TYPES) {
      expect(returnedFrameworks).toContain(fw);
    }
    expect(result.frameworkReadiness).toHaveLength(FRAMEWORK_TYPES.length);
  });

  it("distanceToTarget has all expected fields", () => {
    const result = generatePostureAssessment(bareInput, "CMMC_L2");
    expect(result.distanceToTarget).toHaveProperty("currentScore");
    expect(result.distanceToTarget).toHaveProperty("targetScore");
    expect(result.distanceToTarget).toHaveProperty("distance");
    expect(result.distanceToTarget).toHaveProperty("percentOfWayThere");
    expect(result.distanceToTarget).toHaveProperty("status");
  });

  it("categoryScores contains all nine categories", () => {
    const result = generatePostureAssessment(fullInput, "CIS");
    const expectedCategories = [
      "identity_access",
      "endpoint_security",
      "vulnerability_management",
      "network_security",
      "backup_recovery",
      "monitoring_logging",
      "compliance_evidence",
      "security_awareness",
      "incident_response",
    ];
    for (const cat of expectedCategories) {
      expect(result.categoryScores).toHaveProperty(cat);
    }
  });

  it("roadmapItems length equals gaps length (one item per gap)", () => {
    const result = generatePostureAssessment(bareInput, "CMMC_L2");
    expect(result.roadmapItems).toHaveLength(result.gaps.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment — scoring correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureAssessment — scoring correctness", () => {
  it("full-coverage tenant has overallScore ≥ 85", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(result.overallScore).toBeGreaterThanOrEqual(85);
  });

  it("bare tenant has overallScore ≤ 35", () => {
    const result = generatePostureAssessment(bareInput, "CMMC_L2");
    expect(result.overallScore).toBeLessThanOrEqual(35);
  });

  it("overallScore is clamped between 0 and 100", () => {
    for (const input of [fullInput, bareInput]) {
      const result = generatePostureAssessment(input, "HIPAA");
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    }
  });

  it("readinessPercentage is clamped between 0 and 100", () => {
    for (const input of [fullInput, bareInput]) {
      const result = generatePostureAssessment(input, "SOC2");
      expect(result.readinessPercentage).toBeGreaterThanOrEqual(0);
      expect(result.readinessPercentage).toBeLessThanOrEqual(100);
    }
  });

  it("targetFramework is normalised to uppercase", () => {
    const result = generatePostureAssessment(fullInput, "cmmc_l2");
    expect(result.targetFramework).toBe("CMMC_L2");
  });

  it("targetScore for CMMC_L2 is higher than for CMMC_L1", () => {
    const l1 = generatePostureAssessment(fullInput, "CMMC_L1");
    const l2 = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(l2.targetScore).toBeGreaterThan(l1.targetScore);
  });

  it("distanceToTarget.distance is 0 when overallScore >= targetScore", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L1");
    if (result.overallScore >= result.targetScore) {
      expect(result.distanceToTarget.distance).toBe(0);
      expect(result.distanceToTarget.status).toBe("ready");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment — gap / roadmap propagation
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureAssessment — gaps and roadmap", () => {
  it("full-coverage tenant produces zero gaps", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(result.gaps).toHaveLength(0);
    expect(result.roadmapItems).toHaveLength(0);
  });

  it("bare tenant produces at least one critical gap", () => {
    const result = generatePostureAssessment(bareInput, "CMMC_L2");
    const critical = result.gaps.filter((g) => g.severity === "critical");
    expect(critical.length).toBeGreaterThan(0);
  });

  it("roadmap items are sorted: critical before high before medium", () => {
    const result = generatePostureAssessment(bareInput, "CMMC_L2");
    const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;
    for (let i = 1; i < result.roadmapItems.length; i++) {
      const prevIdx = PRIORITY_ORDER.indexOf(result.roadmapItems[i - 1].priority);
      const currIdx = PRIORITY_ORDER.indexOf(result.roadmapItems[i].priority);
      expect(prevIdx).toBeLessThanOrEqual(currIdx);
    }
  });

  it("gaps and roadmapItems are scoped to targetFramework", () => {
    const r1 = generatePostureAssessment(bareInput, "CMMC_L2");
    const r2 = generatePostureAssessment(bareInput, "HIPAA");
    for (const gap of r1.gaps) expect(gap.framework).toBe("CMMC_L2");
    for (const gap of r2.gaps) expect(gap.framework).toBe("HIPAA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment — isEstimated flag
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureAssessment — isEstimated", () => {
  it("isEstimated=true propagates from input", () => {
    const result = generatePostureAssessment({ ...fullInput, isEstimated: true }, "CMMC_L2");
    expect(result.isEstimated).toBe(true);
  });

  it("isEstimated defaults to false for a fully-populated input", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(result.isEstimated).toBe(false);
  });

  it("isEstimated is true when totalAssets and totalUsers are both 0", () => {
    const emptyInput: PostureScoringInput = {
      ...bareInput,
      totalAssets: 0,
      totalUsers: 0,
    };
    const result = generatePostureAssessment(emptyInput, "NIST");
    expect(result.isEstimated).toBe(true);
  });

  it("isEstimated=true propagates into all gap records", () => {
    const result = generatePostureAssessment({ ...bareInput, isEstimated: true }, "CMMC_L2");
    expect(result.gaps.length).toBeGreaterThan(0);
    for (const gap of result.gaps) {
      expect(gap.isEstimated).toBe(true);
    }
  });

  it("summary mentions '(based on estimated data)' when isEstimated=true", () => {
    const result = generatePostureAssessment({ ...bareInput, isEstimated: true }, "CMMC_L2");
    expect(result.summary).toContain("estimated data");
  });

  it("summary does NOT mention estimated when isEstimated=false", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(result.summary).not.toContain("estimated data");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment — options (clientId / assessmentName)
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureAssessment — options", () => {
  it("clientId is present in result when passed via options", () => {
    const result = generatePostureAssessment(fullInput, "SOC2", { clientId: "client-abc" });
    expect(result.clientId).toBe("client-abc");
  });

  it("assessmentName is present in result when passed via options", () => {
    const result = generatePostureAssessment(fullInput, "SOC2", { assessmentName: "Q1 2026 Assessment" });
    expect(result.assessmentName).toBe("Q1 2026 Assessment");
  });

  it("clientId is absent from result when not passed", () => {
    const result = generatePostureAssessment(fullInput, "SOC2");
    expect(result.clientId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureAssessment — summary text
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureAssessment — summary text", () => {
  it("summary is a non-empty string", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("summary contains overallScore", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L2");
    expect(result.summary).toContain(String(result.overallScore));
  });

  it("summary contains targetFramework", () => {
    const result = generatePostureAssessment(fullInput, "HIPAA");
    expect(result.summary).toContain("HIPAA");
  });

  it("summary mentions 'critical' gaps count when critical gaps exist", () => {
    const result = generatePostureAssessment(bareInput, "CMMC_L2");
    const critCount = result.gaps.filter((g) => g.severity === "critical").length;
    if (critCount > 0) {
      expect(result.summary).toContain("critical");
    }
  });

  it("summary says 'No critical or high gaps' when gaps array is empty", () => {
    const result = generatePostureAssessment(fullInput, "CMMC_L1");
    if (result.gaps.length === 0) {
      expect(result.summary).toContain("No critical or high gaps");
    }
  });
});
