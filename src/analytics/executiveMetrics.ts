/**
 * Executive confidence metrics — aggregates MTTD/MTTR, enforcement rates, posture,
 * simulation quality, and agent reliability with daily snapshots and trend analysis.
 *
 * Feed from audits, findings, policy_decisions, remediation_actions, and simulator results.
 */

/** ISO calendar date (YYYY-MM-DD) */
export type MetricDayId = string;

export type ExecutiveConfidenceDailySnapshot = {
  day: MetricDayId;
  /** Mean time to detect (minutes); null when no samples */
  meanTimeToDetectMinutes: number | null;
  /** Mean time to remediate (minutes); null when no samples */
  meanTimeToRemediateMinutes: number | null;
  /** Policies enforced / applicable evaluations × 100 */
  policyEnforcementRatePct: number;
  /** Autonomous remediation actions / total remediation × 100 */
  autonomousRemediationRatePct: number;
  /** Reduction vs prior attack-surface index (positive = reduced exposure) */
  attackSurfaceReductionPct: number;
  unresolvedCriticalFindings: number;
  /** Controls mapped or evaluated / controls in scope × 100 */
  complianceCoveragePct: number;
  /** False positives / reviewed findings × 100 */
  falsePositiveRatePct: number;
  /** Composite posture momentum [-1, 1]; positive = improving */
  securityPostureTrendIndex: number;
  /** Simulator / lab pass rate × 100 */
  simulationPassRatePct: number;
  /** Agent validators or jobs succeeded / total × 100 */
  agentReliabilityScorePct: number;
  metadata?: Record<string, unknown>;
};

/** Raw inputs for a single day — callers aggregate from DB/simulators */
export type ExecutiveMetricsDaySource = {
  day: MetricDayId;
  /** Durations from alert/detection timestamps */
  detectionDurationsMinutes: number[];
  /** Durations from open → remediated or closed */
  remediationDurationsMinutes: number[];
  policyEvaluationsTotal: number;
  policyEvaluationsEnforced: number;
  remediationActionsTotal: number;
  remediationActionsAutonomous: number;
  /** Prior-period aggregate attack surface index (same scale as current) */
  attackSurfaceIndexPrior: number;
  attackSurfaceIndexCurrent: number;
  unresolvedCriticalFindings: number;
  complianceControlsCovered: number;
  complianceControlsInScope: number;
  findingsMarkedFalsePositive: number;
  findingsReviewedForFp: number;
  simulationRunsPassed: number;
  simulationRunsTotal: number;
  agentRunsSucceeded: number;
  agentRunsTotal: number;
};

export type MetricPolarity = "lower_is_better" | "higher_is_better";

export const EXECUTIVE_METRIC_KEYS = [
  "meanTimeToDetectMinutes",
  "meanTimeToRemediateMinutes",
  "policyEnforcementRatePct",
  "autonomousRemediationRatePct",
  "attackSurfaceReductionPct",
  "unresolvedCriticalFindings",
  "complianceCoveragePct",
  "falsePositiveRatePct",
  "securityPostureTrendIndex",
  "simulationPassRatePct",
  "agentReliabilityScorePct",
] as const;

export type ExecutiveMetricKey = (typeof EXECUTIVE_METRIC_KEYS)[number];

export const METRIC_POLARITY: Record<ExecutiveMetricKey, MetricPolarity> = {
  meanTimeToDetectMinutes: "lower_is_better",
  meanTimeToRemediateMinutes: "lower_is_better",
  policyEnforcementRatePct: "higher_is_better",
  autonomousRemediationRatePct: "higher_is_better",
  attackSurfaceReductionPct: "higher_is_better",
  unresolvedCriticalFindings: "lower_is_better",
  complianceCoveragePct: "higher_is_better",
  falsePositiveRatePct: "lower_is_better",
  securityPostureTrendIndex: "higher_is_better",
  simulationPassRatePct: "higher_is_better",
  agentReliabilityScorePct: "higher_is_better",
};

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function safeRatioPct(numerator: number, denominator: number): number {
  if (denominator <= 0 || !Number.isFinite(denominator)) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 1000) / 10));
}

function attackSurfaceReductionPct(prior: number, current: number): number {
  if (prior <= 0 || !Number.isFinite(prior)) return 0;
  return Math.round(((prior - current) / prior) * 1000) / 10;
}

/**
 * Build one daily executive snapshot from aggregated source counters.
 */
export function buildExecutiveDailySnapshot(src: ExecutiveMetricsDaySource): ExecutiveConfidenceDailySnapshot {
  const mttd = mean(src.detectionDurationsMinutes);
  const mttr = mean(src.remediationDurationsMinutes);

  const policyEnforcementRatePct = safeRatioPct(src.policyEvaluationsEnforced, src.policyEvaluationsTotal);
  const autonomousRemediationRatePct = safeRatioPct(
    src.remediationActionsAutonomous,
    src.remediationActionsTotal,
  );
  const asr = attackSurfaceReductionPct(src.attackSurfaceIndexPrior, src.attackSurfaceIndexCurrent);
  const complianceCoveragePct = safeRatioPct(src.complianceControlsCovered, src.complianceControlsInScope);
  const falsePositiveRatePct = safeRatioPct(src.findingsMarkedFalsePositive, src.findingsReviewedForFp);
  const simulationPassRatePct = safeRatioPct(src.simulationRunsPassed, src.simulationRunsTotal);
  const agentReliabilityScorePct = safeRatioPct(src.agentRunsSucceeded, src.agentRunsTotal);

  const securityPostureTrendIndex = computePostureTrendIndex({
    mttdMinutes: mttd,
    mttrMinutes: mttr,
    policyEnforcementRatePct,
    autonomousRemediationRatePct,
    attackSurfaceReductionPct: asr,
    unresolvedCritical: src.unresolvedCriticalFindings,
    complianceCoveragePct,
    falsePositiveRatePct,
    simulationPassRatePct,
    agentReliabilityScorePct,
  });

  return {
    day: src.day,
    meanTimeToDetectMinutes: mttd,
    meanTimeToRemediateMinutes: mttr,
    policyEnforcementRatePct,
    autonomousRemediationRatePct,
    attackSurfaceReductionPct: asr,
    unresolvedCriticalFindings: Math.max(0, Math.floor(src.unresolvedCriticalFindings)),
    complianceCoveragePct,
    falsePositiveRatePct,
    securityPostureTrendIndex,
    simulationPassRatePct,
    agentReliabilityScorePct,
  };
}

/** Normalize inputs into a single [-1, 1] posture momentum score for the day */
export function computePostureTrendIndex(args: {
  mttdMinutes: number | null;
  mttrMinutes: number | null;
  policyEnforcementRatePct: number;
  autonomousRemediationRatePct: number;
  attackSurfaceReductionPct: number;
  unresolvedCritical: number;
  complianceCoveragePct: number;
  falsePositiveRatePct: number;
  simulationPassRatePct: number;
  agentReliabilityScorePct: number;
}): number {
  const inv = (x: number | null, cap: number) =>
    x === null ? 0 : Math.min(1, Math.max(0, 1 - Math.min(x, cap) / cap));

  const pieces = [
    inv(args.mttdMinutes, 24 * 60) * 0.15,
    inv(args.mttrMinutes, 168 * 60) * 0.15,
    (args.policyEnforcementRatePct / 100) * 0.12,
    (args.autonomousRemediationRatePct / 100) * 0.08,
    Math.min(1, Math.max(-1, args.attackSurfaceReductionPct / 50)) * 0.1,
    Math.min(1, 1 - Math.min(args.unresolvedCritical, 50) / 50) * 0.12,
    (args.complianceCoveragePct / 100) * 0.1,
    (1 - args.falsePositiveRatePct / 100) * 0.06,
    (args.simulationPassRatePct / 100) * 0.06,
    (args.agentReliabilityScorePct / 100) * 0.06,
  ];
  const raw = pieces.reduce((a, b) => a + b, 0);
  return Math.round((raw * 2 - 1) * 1000) / 1000;
}

export type TrendDirection = "improving" | "stable" | "declining";

export type MetricTrend = {
  key: ExecutiveMetricKey;
  direction: TrendDirection;
  slopePerDay: number;
  /** First vs last value in window */
  delta: number | null;
};

function numericSeriesForKey(
  snap: ExecutiveConfidenceDailySnapshot,
  key: ExecutiveMetricKey,
): number | null {
  switch (key) {
    case "meanTimeToDetectMinutes":
      return snap.meanTimeToDetectMinutes;
    case "meanTimeToRemediateMinutes":
      return snap.meanTimeToRemediateMinutes;
    case "policyEnforcementRatePct":
      return snap.policyEnforcementRatePct;
    case "autonomousRemediationRatePct":
      return snap.autonomousRemediationRatePct;
    case "attackSurfaceReductionPct":
      return snap.attackSurfaceReductionPct;
    case "unresolvedCriticalFindings":
      return snap.unresolvedCriticalFindings;
    case "complianceCoveragePct":
      return snap.complianceCoveragePct;
    case "falsePositiveRatePct":
      return snap.falsePositiveRatePct;
    case "securityPostureTrendIndex":
      return snap.securityPostureTrendIndex;
    case "simulationPassRatePct":
      return snap.simulationPassRatePct;
    case "agentReliabilityScorePct":
      return snap.agentReliabilityScorePct;
    default:
      return null;
  }
}

/** Simple least-squares slope over window (x = day index 0..n-1) */
export function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

const EPS = 1e-6;

export function classifyTrend(
  slope: number,
  polarity: MetricPolarity,
): TrendDirection {
  if (Math.abs(slope) <= EPS) return "stable";
  if (polarity === "higher_is_better") {
    return slope > 0 ? "improving" : "declining";
  }
  return slope < 0 ? "improving" : "declining";
}

/**
 * Trend analysis across consecutive daily snapshots (same metric keys).
 */
export function analyzeExecutiveTrends(
  snapshots: ExecutiveConfidenceDailySnapshot[],
): MetricTrend[] {
  if (snapshots.length < 2) return [];

  const sorted = [...snapshots].sort((a, b) => a.day.localeCompare(b.day));
  const out: MetricTrend[] = [];

  for (const key of EXECUTIVE_METRIC_KEYS) {
    const series = sorted
      .map((s) => numericSeriesForKey(s, key))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    if (series.length < 2) continue;

    const slope = linearSlope(series);
    const direction = classifyTrend(slope, METRIC_POLARITY[key]);
    const first = series[0]!;
    const last = series[series.length - 1]!;
    out.push({
      key,
      direction,
      slopePerDay: Math.round(slope * 10000) / 10000,
      delta: Math.round((last - first) * 1000) / 1000,
    });
  }

  return out;
}

export type ExecutiveDashboardSummary = {
  schema_version: "1.0.0";
  generatedAt: string;
  /** Latest day in the series */
  asOfDay: MetricDayId;
  /** Number of daily snapshots included */
  snapshotCount: number;
  /** Most recent snapshot */
  current: ExecutiveConfidenceDailySnapshot;
  /** Previous snapshot if available */
  previous: ExecutiveConfidenceDailySnapshot | null;
  trends: MetricTrend[];
  /** Rollups for tiles */
  headline: string;
  /** Domain-shaped summary for UI cards */
  cards: {
    detectionAndResponse: {
      mttdMinutes: number | null;
      mttrMinutes: number | null;
      trendMttd: TrendDirection;
      trendMttr: TrendDirection;
    };
    policyAndAutomation: {
      policyEnforcementRatePct: number;
      autonomousRemediationRatePct: number;
    };
    exposureAndRisk: {
      attackSurfaceReductionPct: number;
      unresolvedCriticalFindings: number;
    };
    assurance: {
      complianceCoveragePct: number;
      falsePositiveRatePct: number;
      simulationPassRatePct: number;
      agentReliabilityScorePct: number;
    };
    posture: {
      securityPostureTrendIndex: number;
      postureMomentum: TrendDirection;
    };
  };
};

function trendFor(key: ExecutiveMetricKey, trends: MetricTrend[]): TrendDirection {
  return trends.find((t) => t.key === key)?.direction ?? "stable";
}

/**
 * Build an executive dashboard summary from ordered daily snapshots (newest last or unsorted — will sort by day).
 */
export function buildExecutiveDashboardSummary(
  snapshots: ExecutiveConfidenceDailySnapshot[],
  options?: { generatedAt?: string },
): ExecutiveDashboardSummary | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => a.day.localeCompare(b.day));
  const current = sorted[sorted.length - 1]!;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2]! : null;
  const trends = analyzeExecutiveTrends(sorted);

  const postureMomentum = trendFor("securityPostureTrendIndex", trends);

  const headlineParts: string[] = [];
  headlineParts.push(`Posture index ${current.securityPostureTrendIndex.toFixed(2)}`);
  if (previous) {
    const d = current.securityPostureTrendIndex - previous.securityPostureTrendIndex;
    headlineParts.push(`(${d >= 0 ? "+" : ""}${d.toFixed(2)} vs prior day)`);
  }

  return {
    schema_version: "1.0.0",
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    asOfDay: current.day,
    snapshotCount: sorted.length,
    current,
    previous,
    trends,
    headline: headlineParts.join(" "),
    cards: {
      detectionAndResponse: {
        mttdMinutes: current.meanTimeToDetectMinutes,
        mttrMinutes: current.meanTimeToRemediateMinutes,
        trendMttd: trendFor("meanTimeToDetectMinutes", trends),
        trendMttr: trendFor("meanTimeToRemediateMinutes", trends),
      },
      policyAndAutomation: {
        policyEnforcementRatePct: current.policyEnforcementRatePct,
        autonomousRemediationRatePct: current.autonomousRemediationRatePct,
      },
      exposureAndRisk: {
        attackSurfaceReductionPct: current.attackSurfaceReductionPct,
        unresolvedCriticalFindings: current.unresolvedCriticalFindings,
      },
      assurance: {
        complianceCoveragePct: current.complianceCoveragePct,
        falsePositiveRatePct: current.falsePositiveRatePct,
        simulationPassRatePct: current.simulationPassRatePct,
        agentReliabilityScorePct: current.agentReliabilityScorePct,
      },
      posture: {
        securityPostureTrendIndex: current.securityPostureTrendIndex,
        postureMomentum,
      },
    },
  };
}

/**
 * Append a snapshot to a time series (immutable copy, capped length).
 */
export function appendDailySnapshot(
  history: ExecutiveConfidenceDailySnapshot[],
  snapshot: ExecutiveConfidenceDailySnapshot,
  options?: { maxDays?: number },
): ExecutiveConfidenceDailySnapshot[] {
  const maxDays = options?.maxDays ?? 366;
  const next = [...history, snapshot].sort((a, b) => a.day.localeCompare(b.day));
  if (next.length <= maxDays) return next;
  return next.slice(next.length - maxDays);
}
