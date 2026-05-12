import type { BusinessAsset, BusinessCriticality } from "./asset.schema";

const CRITICALITY_SCORE: Record<BusinessCriticality, number> = {
  mission_critical: 30,
  high: 22,
  medium: 14,
  low: 8,
  informational: 4,
};

const SEVERITY_SCORE: Record<string, number> = {
  critical: 18,
  high: 12,
  medium: 7,
  low: 3,
};

function vulnScore(severity?: string): number {
  if (!severity) return 5;
  const k = severity.toLowerCase();
  return SEVERITY_SCORE[k] ?? 5;
}

export type AssetRiskContext = {
  score_0_100: number;
  factors: string[];
  business_criticality: BusinessCriticality;
  exposure_surface: number;
  vulnerability_pressure: number;
};

/**
 * Derives a bounded risk score from business criticality, network exposure, and vulnerability posture.
 */
export function buildAssetRiskContext(asset: BusinessAsset): AssetRiskContext {
  const factors: string[] = [];
  let score = CRITICALITY_SCORE[asset.business_criticality];
  factors.push(`Business criticality: ${asset.business_criticality}`);

  const exposure_surface = asset.ip_addresses.length + asset.exposed_services.length * 2;
  score += Math.min(25, exposure_surface * 2);
  if (exposure_surface > 0) {
    factors.push(`Exposure surface (addresses + services): ${exposure_surface}`);
  }

  let vulnerability_pressure = 0;
  for (const v of asset.vulnerabilities) {
    const add = vulnScore(v.severity);
    vulnerability_pressure += add;
    score += add;
  }
  if (asset.vulnerabilities.length) {
    factors.push(`${asset.vulnerabilities.length} tracked vulnerability(ies)`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score_0_100: score,
    factors,
    business_criticality: asset.business_criticality,
    exposure_surface,
    vulnerability_pressure,
  };
}
