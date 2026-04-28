/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Tests for quantumReadinessScoring — aggregate score calculation.
 */

import { calculateQuantumReadinessScore } from "../quantumReadinessScoring";
import type { CryptoInventoryItem } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID = "test-client-001";
const SCAN_ID = "test-scan-001";

function makeItem(overrides: Partial<CryptoInventoryItem>): CryptoInventoryItem {
  return {
    clientId: CLIENT_ID,
    cryptoUsage: "tls",
    algorithm: "RSA-2048",
    isQuantumVulnerable: true,
    quantumRiskLevel: "high",
    vulnerabilityStatus: "quantum_vulnerable",
    discoverySource: "test",
    evidence: {},
    ...overrides,
  };
}

// ── Empty inventory ───────────────────────────────────────────────────────────

describe("calculateQuantumReadinessScore — empty inventory", () => {
  it("returns score of 0 for empty item list", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID, SCAN_ID);
    expect(result.readinessScore).toBe(0);
  });

  it("returns critical recommended priority for empty inventory", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID);
    expect(result.recommendedPriority).toBe("critical");
  });

  it("correctly sets all asset counts to 0", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID);
    expect(result.totalCryptoAssets).toBe(0);
    expect(result.vulnerableCryptoAssets).toBe(0);
    expect(result.highRiskAssets).toBe(0);
    expect(result.mediumRiskAssets).toBe(0);
    expect(result.lowRiskAssets).toBe(0);
  });

  it("passes clientId and scanId through", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID, SCAN_ID);
    expect(result.clientId).toBe(CLIENT_ID);
    expect(result.scanId).toBe(SCAN_ID);
  });
});

// ── Score calculation ─────────────────────────────────────────────────────────

describe("calculateQuantumReadinessScore — scoring logic", () => {
  it("starts at 100 and deducts 12 per high-risk finding", () => {
    const items = [makeItem({ quantumRiskLevel: "high" })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(88);
  });

  it("deducts 20 per critical finding", () => {
    const items = [makeItem({ quantumRiskLevel: "critical" })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(80);
  });

  it("deducts 6 per medium finding", () => {
    const items = [makeItem({ quantumRiskLevel: "medium" })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(94);
  });

  it("deducts 3 per unknown finding", () => {
    const items = [makeItem({ quantumRiskLevel: "unknown" })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(97);
  });

  it("does not deduct for low-risk findings", () => {
    const items = [
      makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false }),
      makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false }),
    ];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(100);
  });

  it("applies one-time harvest-now penalty of 15", () => {
    const items = [
      makeItem({
        quantumRiskLevel: "high",
        evidence: { harvestNowDecryptLaterRisk: true },
      }),
    ];
    // 100 - 12 (high) - 15 (harvest-now) = 73
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(73);
  });

  it("applies harvest-now penalty only once even with multiple exposed assets", () => {
    const items = [
      makeItem({ quantumRiskLevel: "high", evidence: { harvestNowDecryptLaterRisk: true } }),
      makeItem({ quantumRiskLevel: "high", evidence: { harvestNowDecryptLaterRisk: true } }),
    ];
    // 100 - 12 - 12 - 15 = 61 (penalty applied once)
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(61);
  });

  it("clamps score at 0 — never negative", () => {
    const items = Array.from({ length: 10 }, () => makeItem({ quantumRiskLevel: "critical" }));
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBeGreaterThanOrEqual(0);
    expect(result.readinessScore).toBe(0);
  });

  it("clamps score at 100 — never above 100", () => {
    const items = [makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBeLessThanOrEqual(100);
  });
});

// ── Recommended priority tiers ────────────────────────────────────────────────

describe("calculateQuantumReadinessScore — priority tiers", () => {
  it("assigns critical priority for score 0–39", () => {
    // 5 critical findings: 100 - 100 = 0
    const items = Array.from({ length: 5 }, () => makeItem({ quantumRiskLevel: "critical" }));
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.recommendedPriority).toBe("critical");
  });

  it("assigns high priority for score 40–69", () => {
    // 3 critical: 100 - 60 = 40
    const items = Array.from({ length: 3 }, () => makeItem({ quantumRiskLevel: "critical" }));
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(40);
    expect(result.recommendedPriority).toBe("high");
  });

  it("assigns medium priority for score 70–84", () => {
    // 2 critical + 1 high: 100 - 40 - 12 = 48 → need different mix
    // 1 critical + 1 harvest-now + 1 high: 100 - 20 - 15 - 12 = 53 → high
    // Let's do: 2 critical = 60 → still low enough for high tier
    // score 70: 100 - 30 = 70 → exactly medium threshold
    // Use: 5 high = 100 - 60 = 40 → high tier; let's find 70–84
    // 2 high + 1 medium = 100 - 24 - 6 = 70 → medium
    const items = [
      makeItem({ quantumRiskLevel: "high" }),
      makeItem({ quantumRiskLevel: "high" }),
      makeItem({ quantumRiskLevel: "medium" }),
    ];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(70);
    expect(result.recommendedPriority).toBe("medium");
  });

  it("assigns low priority for score 85–100", () => {
    const items = [makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.recommendedPriority).toBe("low");
  });
});

// ── Asset counts ──────────────────────────────────────────────────────────────

describe("calculateQuantumReadinessScore — asset counts", () => {
  it("correctly counts total, vulnerable, and risk-level assets", () => {
    const items = [
      makeItem({ quantumRiskLevel: "critical", isQuantumVulnerable: true }),
      makeItem({ quantumRiskLevel: "high", isQuantumVulnerable: true }),
      makeItem({ quantumRiskLevel: "medium", isQuantumVulnerable: true }),
      makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false }),
      makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false }),
    ];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.totalCryptoAssets).toBe(5);
    expect(result.vulnerableCryptoAssets).toBe(3);
    expect(result.highRiskAssets).toBe(2);   // critical + high
    expect(result.mediumRiskAssets).toBe(1);
    expect(result.lowRiskAssets).toBe(2);
  });

  it("detects harvest-now exposure correctly", () => {
    const items = [
      makeItem({ evidence: { harvestNowDecryptLaterRisk: true } }),
      makeItem({ evidence: {} }),
    ];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.harvestNowDecryptLaterExposure).toBe(true);
  });

  it("returns false harvest-now exposure when no items are exposed", () => {
    const items = [makeItem({ evidence: { harvestNowDecryptLaterRisk: false } })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.harvestNowDecryptLaterExposure).toBe(false);
  });
});

// ── Summary field ─────────────────────────────────────────────────────────────

describe("calculateQuantumReadinessScore — summary", () => {
  it("includes the score in the summary string", () => {
    const items = [makeItem({ quantumRiskLevel: "high" })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.summary).toContain("88");
  });

  it("mentions harvest-now exposure in summary when present", () => {
    const items = [
      makeItem({ evidence: { harvestNowDecryptLaterRisk: true } }),
    ];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.summary.toLowerCase()).toContain("harvest");
  });

  it("summary always includes a recommended next step", () => {
    const items = [makeItem({ quantumRiskLevel: "critical" })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.summary).toContain("Recommended next step:");
  });

  it("empty inventory summary mentions no assets found", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID);
    expect(result.summary.toLowerCase()).toContain("no cryptographic assets");
  });
});
