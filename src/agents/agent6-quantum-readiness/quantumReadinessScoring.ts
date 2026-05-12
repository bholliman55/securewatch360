/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Aggregate Quantum Readiness Score calculation from a crypto inventory.
 */

import type {
  CryptoInventoryItem,
  QuantumReadinessAssessment,
  QuantumRiskLevel,
} from "./types";

// ── Scoring Constants ─────────────────────────────────────────────────────────

const SCORE_PENALTIES: Record<QuantumRiskLevel | "harvest_now", number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 0,
  unknown: 3,
  harvest_now: 15,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculates a Quantum Readiness Assessment from a list of discovered
 * cryptographic assets. All items should have already been enriched by
 * analyzeQuantumRisk() before being passed here.
 */
export function calculateQuantumReadinessScore(
  items: CryptoInventoryItem[],
  clientId: string,
  scanId?: string,
): QuantumReadinessAssessment {
  if (items.length === 0) {
    return emptyAssessment(clientId, scanId);
  }

  let score = 100;

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let vulnerableCount = 0;
  let harvestNowExposed = false;

  for (const item of items) {
    const level = item.quantumRiskLevel;

    if (item.isQuantumVulnerable) vulnerableCount++;

    switch (level) {
      case "critical":
        score -= SCORE_PENALTIES.critical;
        criticalCount++;
        break;
      case "high":
        score -= SCORE_PENALTIES.high;
        highCount++;
        break;
      case "medium":
        score -= SCORE_PENALTIES.medium;
        mediumCount++;
        break;
      case "unknown":
        score -= SCORE_PENALTIES.unknown;
        break;
      case "low":
        lowCount++;
        break;
    }

    if (item.evidence?.["harvestNowDecryptLaterRisk"] === true) {
      harvestNowExposed = true;
    }
  }

  // One-time harvest-now penalty
  if (harvestNowExposed) {
    score -= SCORE_PENALTIES.harvest_now;
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const recommendedPriority = derivePriority(finalScore);
  const summary = buildSummary({
    score: finalScore,
    total: items.length,
    vulnerable: vulnerableCount,
    critical: criticalCount,
    high: highCount,
    harvestNow: harvestNowExposed,
    priority: recommendedPriority,
  });

  return {
    clientId,
    scanId,
    readinessScore: finalScore,
    totalCryptoAssets: items.length,
    vulnerableCryptoAssets: vulnerableCount,
    highRiskAssets: highCount + criticalCount,
    mediumRiskAssets: mediumCount,
    lowRiskAssets: lowCount,
    harvestNowDecryptLaterExposure: harvestNowExposed,
    recommendedPriority,
    summary,
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function derivePriority(score: number): QuantumRiskLevel {
  if (score <= 39) return "critical";
  if (score <= 69) return "high";
  if (score <= 84) return "medium";
  return "low";
}

function buildSummary(params: {
  score: number;
  total: number;
  vulnerable: number;
  critical: number;
  high: number;
  harvestNow: boolean;
  priority: QuantumRiskLevel;
}): string {
  const { score, total, vulnerable, critical, high, harvestNow, priority } = params;

  const parts: string[] = [
    `Quantum Readiness Score: ${score}/100.`,
    `${total} cryptographic asset${total !== 1 ? "s" : ""} evaluated; ${vulnerable} use quantum-vulnerable algorithms.`,
  ];

  if (critical > 0 || high > 0) {
    parts.push(
      `${critical + high} asset${critical + high !== 1 ? "s" : ""} rated critical or high — immediate migration planning required.`,
    );
  }

  if (harvestNow) {
    parts.push(
      "Harvest-now-decrypt-later exposure detected: adversaries may be collecting ciphertext today for future quantum decryption.",
    );
  }

  const nextStep = {
    critical:
      "Prioritise post-quantum migration for all critical and high-risk assets as an urgent initiative.",
    high:
      "Begin post-quantum cryptography (PQC) migration planning and engage vendors on PQC roadmaps.",
    medium:
      "Inventory all remaining classical cryptographic assets and schedule PQC migration within 24 months.",
    low:
      "Maintain PQC posture; review annually and monitor NIST PQC standard updates.",
    unknown:
      "Complete cryptographic inventory and classify all assets before advancing PQC migration.",
  }[priority];

  parts.push(`Recommended next step: ${nextStep}`);

  return parts.join(" ");
}

function emptyAssessment(clientId: string, scanId?: string): QuantumReadinessAssessment {
  return {
    clientId,
    scanId,
    readinessScore: 0,
    totalCryptoAssets: 0,
    vulnerableCryptoAssets: 0,
    highRiskAssets: 0,
    mediumRiskAssets: 0,
    lowRiskAssets: 0,
    harvestNowDecryptLaterExposure: false,
    recommendedPriority: "critical",
    summary:
      "No cryptographic assets found in inventory. A score of 0 is assigned until a complete inventory is established. Begin with a full cryptographic discovery scan.",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
