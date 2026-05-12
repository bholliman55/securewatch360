import type { AttackPathAssetNode, AttackPathStep, BlastRadiusBand, BlastRadiusEstimate } from "./types";

const EXPOSURE_WEIGHT: Record<AttackPathAssetNode["exposure"], number> = {
  internet: 25,
  external: 18,
  partner: 12,
  internal: 8,
  isolated: 3,
};

function bandFromScore(score: number): BlastRadiusBand {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Heuristic blast-radius estimate from touched assets, exposure, policy gaps, and chain length.
 * Intended for dashboard sizing — not a quantitative cyber-risk model.
 */
export function estimateBlastRadius(
  assets: AttackPathAssetNode[],
  steps: AttackPathStep[],
): BlastRadiusEstimate {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const affected = new Set<string>();
  for (const s of steps) {
    for (const id of s.affected_asset_ids) {
      affected.add(id);
    }
  }

  let exposureScore = 0;
  let internetCount = 0;
  for (const id of affected) {
    const a = assetById.get(id);
    if (!a) continue;
    exposureScore += EXPOSURE_WEIGHT[a.exposure];
    if (a.exposure === "internet") internetCount += 1;
  }

  const policyFailures = steps.filter((s) => s.policy_failed).length;
  const policyBoost = policyFailures * 12;
  const stepBoost = Math.min(30, steps.length * 4);
  const blockedPenalty = steps.some((s) => s.chain_blocked) ? -10 : 0;

  const raw = exposureScore + policyBoost + stepBoost + blockedPenalty;
  const score_0_100 = Math.max(0, Math.min(100, Math.round(raw)));

  const factors: string[] = [];
  if (affected.size > 0) factors.push(`${affected.size} affected system(s)`);
  if (internetCount > 0) factors.push(`${internetCount} internet-exposed asset(s)`);
  if (policyFailures > 0) factors.push(`${policyFailures} policy failure point(s)`);
  if (steps.some((s) => s.chain_blocked)) factors.push("Attack chain blocked (reduced downstream spread)");

  return {
    score_0_100,
    band: bandFromScore(score_0_100),
    factors: factors.length > 0 ? factors : ["No assets linked to path steps"],
    affected_asset_count: affected.size,
    internet_exposed_asset_count: internetCount,
  };
}
