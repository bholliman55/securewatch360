import type { ComplianceSignals, RiskScoringFactor } from "./riskScore.schema";

export type ComplianceImpactResult = {
  normalized_0_1: number;
  factors: RiskScoringFactor[];
};

/**
 * Maps compliance posture signals to a normalized compliance-risk contribution.
 */
export function scoreComplianceImpact(compliance: ComplianceSignals): ComplianceImpactResult {
  const factors: RiskScoringFactor[] = [];
  const frameworkWeight = Math.min(1, compliance.frameworks_in_scope.length / 4);
  const gapNorm = Math.min(1, compliance.control_gap_count / 12);
  let drift = compliance.policy_drift_detected ? 0.35 : 0;

  if (compliance.frameworks_in_scope.length > 0) {
    factors.push({
      id: "framework_scope",
      points: Math.round(frameworkWeight * 100),
      rationale: `In-scope frameworks (${compliance.frameworks_in_scope.length}) widen regulatory and audit exposure if controls fail.`,
    });
  }
  if (compliance.control_gap_count > 0) {
    factors.push({
      id: "control_gaps",
      points: Math.round(gapNorm * 100),
      rationale: `${compliance.control_gap_count} mapped control gap(s) increase the chance of formal findings and mandatory remediation.`,
    });
  }
  if (compliance.policy_drift_detected) {
    factors.push({
      id: "policy_drift",
      points: 35,
      rationale: "Observed drift between deployed posture and documented policy creates latent compliance failure on the next assessment.",
    });
  }

  const normalized = Math.min(1, 0.35 * frameworkWeight + 0.45 * gapNorm + drift);

  if (factors.length === 0) {
    factors.push({
      id: "compliance_neutral",
      points: 0,
      rationale: "Limited compliance-scope signals; compliance risk is inferred as secondary unless other drivers apply.",
    });
  }

  return { normalized_0_1: normalized, factors };
}
