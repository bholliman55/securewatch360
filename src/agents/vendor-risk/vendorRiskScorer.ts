import type { OsintIntelligenceEvent } from "@/services/data-acquisition/acquisitionTypes";

export type RiskTier = "critical" | "high" | "medium" | "low";

export interface VendorRiskScore {
  riskTier: RiskTier;
  overallScore: number;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export function scoreVendorSignals(signals: OsintIntelligenceEvent[]): VendorRiskScore {
  let score = 0;
  for (const signal of signals) {
    score += SEVERITY_WEIGHTS[signal.severity] ?? 0;
  }
  score = Math.min(score, 100);

  let riskTier: RiskTier;
  if (score >= 75) riskTier = "critical";
  else if (score >= 50) riskTier = "high";
  else if (score >= 25) riskTier = "medium";
  else riskTier = "low";

  return { riskTier, overallScore: score };
}
