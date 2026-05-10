import { calculateBlastRadius } from "./blastRadiusCalculator";
import { scoreBusinessImpact } from "./businessImpactScorer";
import { scoreComplianceImpact } from "./complianceImpactScorer";
import { scoreExploitability } from "./exploitabilityScorer";
import type { BusinessRiskResult, BusinessRiskSignals, RiskLevel, Urgency } from "./riskScore.schema";
import { businessRiskSignalsSchema } from "./riskScore.schema";

const SEVERITY_POINTS: Record<BusinessRiskSignals["severity"], number> = {
  informational: 4,
  low: 10,
  medium: 22,
  high: 34,
  critical: 44,
};

const EXPOSURE_POINTS: Record<BusinessRiskSignals["internet_exposure"], number> = {
  none: 2,
  internal: 9,
  partner: 16,
  internet: 26,
};

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function urgencyFrom(args: {
  score: number;
  signals: BusinessRiskSignals;
  ransomwareNorm: number;
}): Urgency {
  const { score, signals, ransomwareNorm } = args;
  if (ransomwareNorm >= 0.45 || (signals.known_exploited_vulnerability && signals.internet_exposure === "internet")) {
    return "immediate";
  }
  if (score >= 80 || (signals.known_exploited_vulnerability && score >= 55)) {
    return "immediate";
  }
  if (score >= 60 || signals.known_exploited_vulnerability || signals.identity_exposure.suspicious_session_signals) {
    return "high";
  }
  if (score >= 35) return "medium";
  return "low";
}

function recommendedAction(score: number, signals: BusinessRiskSignals, level: RiskLevel): string {
  if (signals.behavioral_signals?.mass_encryption_like_activity || signals.behavioral_signals?.shadow_copy_deletion_attempts) {
    return "Isolate affected hosts, preserve forensic artifacts, invoke incident response and backup restore runbooks immediately.";
  }
  if (level === "critical" || score >= 75) {
    return "Escalate to security leadership, contain internet exposure, and prioritize emergency change for remediation with executive visibility.";
  }
  if (signals.identity_exposure.suspicious_session_signals) {
    return "Revoke risky sessions, force step-up authentication, and review privileged role assignments tied to this asset.";
  }
  if (signals.compliance.policy_drift_detected || signals.compliance.control_gap_count >= 4) {
    return "Open a compliance remediation workstream: realign controls to policy, document exceptions, and schedule control testing.";
  }
  if (signals.remediation.patch_or_fix_available) {
    return "Apply the available vendor fix or configuration change within the SLA window; validate with targeted scanning.";
  }
  return "Track in the standard remediation queue with monitoring; tune compensating controls if short-term patch delay is approved.";
}

function buildExplanation(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

function computeConfidence(signals: BusinessRiskSignals): number {
  let c = 0.48;
  if (signals.finding_id) c += 0.07;
  if (signals.tenant_id) c += 0.04;
  if (signals.exploitability.public_exploit_known !== undefined || signals.exploitability.attack_complexity_low !== undefined) {
    c += 0.06;
  }
  if (signals.blast_radius_hints && (signals.blast_radius_hints.downstream_asset_count > 0 || signals.blast_radius_hints.lateral_movement_likelihood_0_1)) {
    c += 0.08;
  }
  if (signals.compliance.frameworks_in_scope.length > 0) c += 0.06;
  if (signals.remediation.patch_or_fix_available && signals.remediation.eta_days !== undefined) c += 0.05;
  if (!signals.remediation.patch_or_fix_available) c -= 0.04;
  return Math.min(0.94, Math.max(0.35, c));
}

/**
 * Produces a consolidated business risk score and narrative from multi-factor signals.
 */
export function evaluateBusinessRisk(input: BusinessRiskSignals): BusinessRiskResult {
  const signals = businessRiskSignalsSchema.parse(input);

  const exploit = scoreExploitability(signals.exploitability);
  const blast = calculateBlastRadius(signals.blast_radius_hints, signals.asset_criticality);
  const compliance = scoreComplianceImpact(signals.compliance);
  const business = scoreBusinessImpact({
    assetCriticality: signals.asset_criticality,
    identity: signals.identity_exposure,
    recurrence: signals.recurrence,
    behavioral: signals.behavioral_signals,
  });

  let score =
    SEVERITY_POINTS[signals.severity] +
    exploit.normalized_0_1 * 18 +
    EXPOSURE_POINTS[signals.internet_exposure] +
    business.normalized_0_1 * 22 +
    compliance.normalized_0_1 * 14 +
    blast.normalized_0_1 * 12;

  if (signals.known_exploited_vulnerability) score += 18;

  score -= signals.compensating_controls.strength_0_1 * 24;
  if (signals.remediation.patch_or_fix_available) {
    score -= signals.remediation.eta_days !== undefined && signals.remediation.eta_days <= 7 ? 10 : 6;
  }

  const rz =
    (signals.behavioral_signals?.mass_encryption_like_activity ? 0.5 : 0) +
    (signals.behavioral_signals?.shadow_copy_deletion_attempts ? 0.35 : 0) +
    (signals.behavioral_signals?.suspicious_lateral_movement ? 0.2 : 0);
  const ransomwareNorm = Math.min(1, rz);
  if (ransomwareNorm >= 0.45) {
    score = Math.max(score, 88);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = riskLevelFromScore(score);
  const urgency = urgencyFrom({ score, signals, ransomwareNorm });
  const confidence = computeConfidence(signals);

  const explanation = buildExplanation([
    `Composite risk score ${score}/100 (${level}).`,
    signals.internet_exposure === "internet"
      ? "The finding affects or is reachable from the public internet, which materially increases opportunistic abuse."
      : "",
    signals.known_exploited_vulnerability
      ? "CISA KEV or equivalent indicates active, real-world exploitation — treat as elevated nation-state and criminal risk."
      : "",
    business.factors[0]?.rationale ?? "",
    compliance.factors.find((f) => f.id === "policy_drift")?.rationale ?? "",
  ]);

  return {
    risk_score: score,
    risk_level: level,
    business_explanation: explanation.trim(),
    recommended_action: recommendedAction(score, signals, level),
    urgency,
    confidence,
  };
}
