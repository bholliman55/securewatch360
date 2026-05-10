/**
 * Unit tests for postureScoringService.ts
 * Test runner: Vitest
 */
import { describe, it, expect } from "vitest";
import {
  calculateOverallPostureScore,
  calculateFrameworkReadiness,
  generatePostureGaps,
  generateRoadmapItems,
  calculateDistanceToTarget,
} from "../postureScoringService";
import type { PostureScoringInput } from "../postureScoringService";

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const fullCoverageInput: PostureScoringInput = {
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

const bareMinimumInput: PostureScoringInput = {
  tenantId: "tenant-bare",
  openFindings: [
    {
      id: "f1",
      severity: "critical",
      category: "auth",
      assetType: "server",
      exposure: "internet",
      status: "open",
      priorityScore: 100,
    },
    {
      id: "f2",
      severity: "critical",
      category: "endpoint",
      assetType: "workstation",
      exposure: "internal",
      status: "open",
      priorityScore: 95,
    },
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
  criticalVulnsOpenOver7Days: 5,
  highVulnsOpenOver30Days: 10,
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

const partialCoverageInput: PostureScoringInput = {
  tenantId: "tenant-partial",
  openFindings: [],
  totalAssets: 100,
  internetExposedAssets: 10,
  endpointsCoveredByEdr: 80,
  endpointsWithDiskEncryption: 85,
  totalUsers: 100,
  usersWithMfaEnabled: 70,
  privilegedUsersWithMfa: 8,
  totalPrivilegedUsers: 10,
  ssoEnabled: false,
  assetsWithRecentScan: 70,
  criticalVulnsOpenOver7Days: 0,
  highVulnsOpenOver30Days: 2,
  backupConfigured: true,
  backupTestedRecently: false,
  offsiteBackupEnabled: true,
  immutableBackupEnabled: false,
  centralizedLoggingEnabled: true,
  auditLoggingEnabled: false,
  siemConnected: false,
  controlsMapped: 60,
  totalControls: 100,
  evidenceArtifactsUploaded: 30,
  sspDocumented: false,
  trainingCompletionPercent: 75,
  phishingSimulationActive: true,
  // 60 days ago — within 12 months
  lastTrainingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  irpDocumented: true,
  irpTestedRecently: false,
  breachNotificationProcedure: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateOverallPostureScore
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateOverallPostureScore", () => {
  it("full coverage tenant scores ≥ 85 and is labeled Advanced", () => {
    const result = calculateOverallPostureScore(fullCoverageInput);
    expect(result.overallScore).toBeGreaterThanOrEqual(85);
    expect(result.maturityLabel).toBe("Advanced");
  });

  it("bare minimum tenant scores ≤ 35", () => {
    const result = calculateOverallPostureScore(bareMinimumInput);
    expect(result.overallScore).toBeLessThanOrEqual(35);
  });

  it("bare minimum tenant is labeled Ad Hoc or Initiating", () => {
    const result = calculateOverallPostureScore(bareMinimumInput);
    expect(["Ad Hoc", "Initiating"]).toContain(result.maturityLabel);
  });

  it("partial coverage tenant scores between 45 and 70", () => {
    const result = calculateOverallPostureScore(partialCoverageInput);
    expect(result.overallScore).toBeGreaterThanOrEqual(45);
    expect(result.overallScore).toBeLessThanOrEqual(70);
  });

  it("isEstimated=true propagates to result", () => {
    const result = calculateOverallPostureScore({ ...fullCoverageInput, isEstimated: true });
    expect(result.isEstimated).toBe(true);
  });

  it("isEstimated defaults to false when not set", () => {
    const result = calculateOverallPostureScore(fullCoverageInput);
    expect(result.isEstimated).toBe(false);
  });

  it("returns all expected category keys in categoryScores", () => {
    const result = calculateOverallPostureScore(fullCoverageInput);
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

  it("overall score is clamped between 0 and 100", () => {
    const result = calculateOverallPostureScore(bareMinimumInput);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateFrameworkReadiness
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateFrameworkReadiness", () => {
  it("CMMC_L2 has a higher target score than CMMC_L1", () => {
    const l1 = calculateFrameworkReadiness(partialCoverageInput, "CMMC_L1");
    const l2 = calculateFrameworkReadiness(partialCoverageInput, "CMMC_L2");
    expect(l2.targetScore).toBeGreaterThan(l1.targetScore);
  });

  it("same input produces different readinessPercent for CIS vs HIPAA", () => {
    const cis = calculateFrameworkReadiness(partialCoverageInput, "CIS");
    const hipaa = calculateFrameworkReadiness(partialCoverageInput, "HIPAA");
    expect(cis.readinessPercent).not.toEqual(hipaa.readinessPercent);
  });

  it("full coverage tenant is ready for CMMC_L1", () => {
    const result = calculateFrameworkReadiness(fullCoverageInput, "CMMC_L1");
    expect(result.status).toBe("ready");
  });

  it("status is ready when readinessPercent >= targetScore", () => {
    const result = calculateFrameworkReadiness(fullCoverageInput, "CIS");
    expect(["ready", "approaching", "gap"]).toContain(result.status);
    if (result.readinessPercent >= result.targetScore) {
      expect(result.status).toBe("ready");
    }
  });

  it("status is approaching when within 15 points of target", () => {
    // Construct an input that should land near-but-below target for CMMC_L1 (target=60)
    const nearInput: PostureScoringInput = {
      ...bareMinimumInput,
      usersWithMfaEnabled: 15,
      privilegedUsersWithMfa: 4,
      endpointsCoveredByEdr: 40,
      endpointsWithDiskEncryption: 40,
      assetsWithRecentScan: 40,
      criticalVulnsOpenOver7Days: 0,
      highVulnsOpenOver30Days: 0,
    };
    const result = calculateFrameworkReadiness(nearInput, "CMMC_L1");
    if (result.readinessPercent >= result.targetScore) {
      expect(result.status).toBe("ready");
    } else if (result.readinessPercent >= result.targetScore - 15) {
      expect(result.status).toBe("approaching");
    } else {
      expect(result.status).toBe("gap");
    }
  });

  it("isEstimated flag propagates in framework readiness result", () => {
    const result = calculateFrameworkReadiness({ ...fullCoverageInput, isEstimated: true }, "NIST");
    expect(result.isEstimated).toBe(true);
  });

  it("readinessPercent is clamped between 0 and 100", () => {
    const result = calculateFrameworkReadiness(bareMinimumInput, "CMMC_L2");
    expect(result.readinessPercent).toBeGreaterThanOrEqual(0);
    expect(result.readinessPercent).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generatePostureGaps
// ─────────────────────────────────────────────────────────────────────────────

describe("generatePostureGaps", () => {
  it("missing MFA for privileged users always produces a critical gap in identity_access", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const gap = gaps.find((g) => g.category === "identity_access" && g.severity === "critical");
    expect(gap).toBeDefined();
  });

  it("!backupConfigured always produces a critical gap in backup_recovery", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const gap = gaps.find((g) => g.category === "backup_recovery" && g.severity === "critical");
    expect(gap).toBeDefined();
  });

  it("internet-exposed assets + critical vulns generates a critical network_security gap", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      internetExposedAssets: 5,
      criticalVulnsOpenOver7Days: 2,
    };
    const gaps = generatePostureGaps(input, "NIST");
    const gap = gaps.find((g) => g.category === "network_security" && g.severity === "critical");
    expect(gap).toBeDefined();
  });

  it("internet-exposed critical vuln gap is NOT generated when criticalVulnsOpenOver7Days = 0", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      internetExposedAssets: 5,
      criticalVulnsOpenOver7Days: 0,
    };
    const gaps = generatePostureGaps(input, "NIST");
    const gap = gaps.find((g) => g.category === "network_security" && g.severity === "critical");
    expect(gap).toBeUndefined();
  });

  it("full coverage tenant generates zero gaps", () => {
    const gaps = generatePostureGaps(fullCoverageInput, "CMMC_L2");
    expect(gaps).toHaveLength(0);
  });

  it("isEstimated=true propagates to all generated gaps", () => {
    const gaps = generatePostureGaps({ ...bareMinimumInput, isEstimated: true }, "CMMC_L2");
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap.isEstimated).toBe(true);
    }
  });

  it("centralizedLogging gap is severity 'high' for CMMC_L2", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      centralizedLoggingEnabled: false,
    };
    const gaps = generatePostureGaps(input, "CMMC_L2");
    const gap = gaps.find((g) => g.category === "monitoring_logging");
    expect(gap?.severity).toBe("high");
  });

  it("centralizedLogging gap is severity 'high' for SOC2", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      centralizedLoggingEnabled: false,
    };
    const gaps = generatePostureGaps(input, "SOC2");
    const gap = gaps.find((g) => g.category === "monitoring_logging");
    expect(gap?.severity).toBe("high");
  });

  it("centralizedLogging gap is severity 'medium' for non-CMMC_L2/SOC2 frameworks", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      centralizedLoggingEnabled: false,
    };
    const gaps = generatePostureGaps(input, "NIST");
    const gap = gaps.find((g) => g.category === "monitoring_logging");
    expect(gap?.severity).toBe("medium");
  });

  it("multiple critical gaps generated for bare minimum tenant", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const criticalGaps = gaps.filter((g) => g.severity === "critical");
    expect(criticalGaps.length).toBeGreaterThan(1);
  });

  it("controlsMapped gap severity is 'high' for CMMC_L2 when coverage < 70%", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      controlsMapped: 50,
      totalControls: 100,
    };
    const gaps = generatePostureGaps(input, "CMMC_L2");
    const gap = gaps.find((g) => g.category === "compliance_evidence");
    expect(gap?.severity).toBe("high");
  });

  it("controlsMapped gap severity is 'medium' for non-CMMC_L2 frameworks", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      controlsMapped: 50,
      totalControls: 100,
    };
    const gaps = generatePostureGaps(input, "NIST");
    const gap = gaps.find((g) => g.category === "compliance_evidence");
    expect(gap?.severity).toBe("medium");
  });

  it("EDR gap severity is critical when coverage < 50%", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      endpointsCoveredByEdr: 40,
      totalAssets: 100,
    };
    const gaps = generatePostureGaps(input, "CIS");
    const gap = gaps.find((g) => g.category === "endpoint_security" && g.currentState.toUpperCase().includes("EDR"));
    expect(gap?.severity).toBe("critical");
  });

  it("EDR gap severity is medium when coverage is 75–89%", () => {
    const input: PostureScoringInput = {
      ...fullCoverageInput,
      endpointsCoveredByEdr: 80,
      totalAssets: 100,
    };
    const gaps = generatePostureGaps(input, "CIS");
    const gap = gaps.find((g) => g.category === "endpoint_security" && g.currentState.toUpperCase().includes("EDR"));
    expect(gap?.severity).toBe("medium");
  });

  it("each gap has required string fields populated", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    for (const gap of gaps) {
      expect(gap.category).toBeTruthy();
      expect(gap.categoryLabel).toBeTruthy();
      expect(gap.currentState).toBeTruthy();
      expect(gap.desiredState).toBeTruthy();
      expect(gap.gapDescription).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateRoadmapItems
// ─────────────────────────────────────────────────────────────────────────────

describe("generateRoadmapItems", () => {
  it("critical items appear before high, high before medium", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const items = generateRoadmapItems(gaps);
    const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

    for (let i = 1; i < items.length; i++) {
      const prevIdx = PRIORITY_ORDER.indexOf(items[i - 1].priority);
      const currIdx = PRIORITY_ORDER.indexOf(items[i].priority);
      expect(prevIdx).toBeLessThanOrEqual(currIdx);
    }
  });

  it("within the same priority band, higher impact score comes first", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const items = generateRoadmapItems(gaps);

    for (let i = 1; i < items.length; i++) {
      if (items[i - 1].priority === items[i].priority) {
        expect(items[i - 1].estimatedImpactScore).toBeGreaterThanOrEqual(
          items[i].estimatedImpactScore
        );
      }
    }
  });

  it("each roadmap item has required fields populated", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const items = generateRoadmapItems(gaps);
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.recommendedAction).toBeTruthy();
      expect(item.estimatedImpactScore).toBeGreaterThanOrEqual(0);
      expect(item.estimatedImpactScore).toBeLessThanOrEqual(100);
      expect(["critical", "high", "medium", "low"]).toContain(item.priority);
      expect(["low", "medium", "high"]).toContain(item.estimatedEffort);
      expect(["now", "later", "not_yet"]).toContain(item.automationLevel);
    }
  });

  it("isEstimated propagates from gaps to roadmap items", () => {
    const gaps = generatePostureGaps({ ...bareMinimumInput, isEstimated: true }, "CMMC_L2");
    const items = generateRoadmapItems(gaps);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.isEstimated).toBe(true);
    }
  });

  it("produces one item per gap", () => {
    const gaps = generatePostureGaps(bareMinimumInput, "CMMC_L2");
    const items = generateRoadmapItems(gaps);
    expect(items).toHaveLength(gaps.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateDistanceToTarget
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateDistanceToTarget", () => {
  it("distance = targetScore - currentScore when below target", () => {
    const result = calculateDistanceToTarget(50, 80);
    expect(result.distance).toBe(30);
  });

  it("distance = 0 when currentScore equals targetScore", () => {
    const result = calculateDistanceToTarget(80, 80);
    expect(result.distance).toBe(0);
  });

  it("distance is clamped to 0 when currentScore exceeds targetScore", () => {
    const result = calculateDistanceToTarget(90, 80);
    expect(result.distance).toBe(0);
  });

  it("status is 'ready' when currentScore >= targetScore", () => {
    expect(calculateDistanceToTarget(80, 80).status).toBe("ready");
    expect(calculateDistanceToTarget(95, 80).status).toBe("ready");
  });

  it("status is 'approaching' when within 15 points below target", () => {
    expect(calculateDistanceToTarget(66, 80).status).toBe("approaching");
    expect(calculateDistanceToTarget(65, 80).status).toBe("approaching");
  });

  it("status is 'gap' when more than 15 points below target", () => {
    expect(calculateDistanceToTarget(64, 80).status).toBe("gap");
    expect(calculateDistanceToTarget(50, 80).status).toBe("gap");
  });

  it("percentOfWayThere is 100 when current equals target", () => {
    const result = calculateDistanceToTarget(80, 80);
    expect(result.percentOfWayThere).toBe(100);
  });

  it("percentOfWayThere is clamped between 0 and 100", () => {
    const result = calculateDistanceToTarget(95, 80);
    expect(result.percentOfWayThere).toBeGreaterThanOrEqual(0);
    expect(result.percentOfWayThere).toBeLessThanOrEqual(100);
  });

  it("returns all expected fields", () => {
    const result = calculateDistanceToTarget(55, 75);
    expect(result).toHaveProperty("currentScore", 55);
    expect(result).toHaveProperty("targetScore", 75);
    expect(result).toHaveProperty("distance", 20);
    expect(result).toHaveProperty("percentOfWayThere");
    expect(result).toHaveProperty("status");
  });
});
