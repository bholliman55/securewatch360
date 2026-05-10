import type { BusinessCriticality } from "../assets/asset.schema";
import type { BlastRadiusHints, RiskScoringFactor } from "./riskScore.schema";

export type BlastRadiusResult = {
  /** 0–1 scale of potential organizational impact if the issue is abused. */
  normalized_0_1: number;
  factors: RiskScoringFactor[];
};

const CRITICALITY_WEIGHT: Record<BusinessCriticality, number> = {
  mission_critical: 1,
  high: 0.85,
  medium: 0.65,
  low: 0.45,
  informational: 0.25,
};

/**
 * Estimates blast radius from topology hints and asset criticality.
 */
export function calculateBlastRadius(
  hints: BlastRadiusHints | undefined,
  assetCriticality: BusinessCriticality,
): BlastRadiusResult {
  const factors: RiskScoringFactor[] = [];
  const h = hints ?? {
    downstream_asset_count: 0,
    sensitive_data_proximity: "none" as const,
    lateral_movement_likelihood_0_1: 0,
  };

  const downstream = Math.min(1, h.downstream_asset_count / 25);
  const lateral = h.lateral_movement_likelihood_0_1 ?? 0;
  let proximity = 0;
  if (h.sensitive_data_proximity === "near") proximity = 0.35;
  if (h.sensitive_data_proximity === "direct") proximity = 0.65;

  const base = 0.22 * downstream + 0.28 * lateral + proximity;
  const weighted = Math.min(1, base * (0.55 + 0.45 * CRITICALITY_WEIGHT[assetCriticality]));

  if (h.downstream_asset_count > 0) {
    factors.push({
      id: "downstream_assets",
      points: Math.round(downstream * 100),
      rationale: `${h.downstream_asset_count} downstream dependent assets could be affected by lateral movement or shared dependencies.`,
    });
  }
  if (lateral > 0.2) {
    factors.push({
      id: "lateral_movement",
      points: Math.round(lateral * 100),
      rationale: "Elevated likelihood of lateral movement increases effective blast radius beyond the initial host.",
    });
  }
  if (proximity > 0) {
    factors.push({
      id: "data_proximity",
      points: Math.round(proximity * 100),
      rationale: `Sensitive data proximity is ${h.sensitive_data_proximity ?? "unknown"} — abuse may impact regulated or high-value datasets.`,
    });
  }
  factors.push({
    id: "criticality_amplifier",
    points: Math.round(CRITICALITY_WEIGHT[assetCriticality] * 100),
    rationale: `Business criticality (${assetCriticality}) scales the blast radius of the same technical issue.`,
  });

  return { normalized_0_1: Math.min(1, Math.max(0, weighted)), factors };
}
