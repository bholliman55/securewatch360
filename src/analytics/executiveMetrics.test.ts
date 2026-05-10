import { describe, expect, it } from "vitest";
import {
  appendDailySnapshot,
  analyzeExecutiveTrends,
  buildExecutiveDailySnapshot,
  buildExecutiveDashboardSummary,
  classifyTrend,
  linearSlope,
} from "./executiveMetrics";

function daySource(over: Partial<Parameters<typeof buildExecutiveDailySnapshot>[0]> = {}) {
  return {
    day: "2026-05-01",
    detectionDurationsMinutes: [60, 120],
    remediationDurationsMinutes: [240],
    policyEvaluationsTotal: 100,
    policyEvaluationsEnforced: 92,
    remediationActionsTotal: 40,
    remediationActionsAutonomous: 10,
    attackSurfaceIndexPrior: 100,
    attackSurfaceIndexCurrent: 85,
    unresolvedCriticalFindings: 3,
    complianceControlsCovered: 44,
    complianceControlsInScope: 50,
    findingsMarkedFalsePositive: 2,
    findingsReviewedForFp: 40,
    simulationRunsPassed: 18,
    simulationRunsTotal: 20,
    agentRunsSucceeded: 95,
    agentRunsTotal: 100,
    ...over,
  };
}

describe("buildExecutiveDailySnapshot", () => {
  it("computes rates and posture index", () => {
    const s = buildExecutiveDailySnapshot(daySource());
    expect(s.meanTimeToDetectMinutes).toBe(90);
    expect(s.policyEnforcementRatePct).toBe(92);
    expect(s.autonomousRemediationRatePct).toBe(25);
    expect(s.complianceCoveragePct).toBe(88);
    expect(s.simulationPassRatePct).toBe(90);
    expect(s.agentReliabilityScorePct).toBe(95);
    expect(s.securityPostureTrendIndex).toBeGreaterThanOrEqual(-1);
    expect(s.securityPostureTrendIndex).toBeLessThanOrEqual(1);
  });
});

describe("trends and dashboard", () => {
  it("detects improving enforcement slope", () => {
    const a = buildExecutiveDailySnapshot(daySource({ day: "2026-05-01", policyEvaluationsEnforced: 80 }));
    const b = buildExecutiveDailySnapshot(daySource({ day: "2026-05-02", policyEvaluationsEnforced: 95 }));
    const trends = analyzeExecutiveTrends([a, b]);
    const pol = trends.find((t) => t.key === "policyEnforcementRatePct");
    expect(pol?.direction).toBe("improving");
  });

  it("builds dashboard summary", () => {
    const s1 = buildExecutiveDailySnapshot(daySource({ day: "2026-05-01" }));
    const s2 = buildExecutiveDailySnapshot(daySource({ day: "2026-05-02", unresolvedCriticalFindings: 2 }));
    const dash = buildExecutiveDashboardSummary([s1, s2]);
    expect(dash?.schema_version).toBe("1.0.0");
    expect(dash?.current.day).toBe("2026-05-02");
    expect(dash?.cards.detectionAndResponse.mttdMinutes).toBeDefined();
  });

  it("appendDailySnapshot caps length", () => {
    const h = appendDailySnapshot(
      [],
      buildExecutiveDailySnapshot(daySource({ day: "2026-05-01" })),
      { maxDays: 2 },
    );
    const h2 = appendDailySnapshot(
      h,
      buildExecutiveDailySnapshot(daySource({ day: "2026-05-02" })),
      { maxDays: 2 },
    );
    const h3 = appendDailySnapshot(
      h2,
      buildExecutiveDailySnapshot(daySource({ day: "2026-05-03" })),
      { maxDays: 2 },
    );
    expect(h3.length).toBe(2);
    expect(h3[0]?.day).toBe("2026-05-02");
  });
});

describe("linearSlope", () => {
  it("is positive for increasing series", () => {
    expect(linearSlope([1, 2, 3])).toBeGreaterThan(0);
  });
});

describe("classifyTrend", () => {
  it("respects polarity", () => {
    expect(classifyTrend(1, "higher_is_better")).toBe("improving");
    expect(classifyTrend(-1, "higher_is_better")).toBe("declining");
    expect(classifyTrend(-1, "lower_is_better")).toBe("improving");
  });
});
