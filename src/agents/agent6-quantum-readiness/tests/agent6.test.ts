/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Comprehensive integration tests for the full assessment pipeline.
 */

import { describe, it, expect } from "vitest";
import { analyzeQuantumRisk } from "../quantumRiskEngine";
import { calculateQuantumReadinessScore } from "../quantumReadinessScoring";
import { generateQuantumRemediationTasks } from "../remediationPlanner";
import type { CryptoInventoryItem, QuantumReadinessAssessment } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID = "test-client-001";
const SCAN_ID = "test-scan-001";

function makeItem(overrides: Partial<CryptoInventoryItem>): CryptoInventoryItem {
  return {
    clientId: CLIENT_ID,
    cryptoUsage: "tls",
    algorithm: "RSA-2048",
    isQuantumVulnerable: false,
    quantumRiskLevel: "unknown",
    vulnerabilityStatus: "unknown",
    discoverySource: "test",
    evidence: {},
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<QuantumReadinessAssessment>): QuantumReadinessAssessment {
  return {
    clientId: CLIENT_ID,
    readinessScore: 100,
    totalCryptoAssets: 0,
    vulnerableCryptoAssets: 0,
    highRiskAssets: 0,
    mediumRiskAssets: 0,
    lowRiskAssets: 0,
    harvestNowDecryptLaterExposure: false,
    recommendedPriority: "low",
    ...overrides,
  };
}

// ── Test 1: RSA-1024 public TLS returns critical ──────────────────────────────

describe("Test 1: RSA-1024 on public TLS", () => {
  it("returns critical risk level", () => {
    const item = makeItem({
      algorithm: "RSA-1024",
      keyLength: 1024,
      assetType: "public_web_app",
      cryptoUsage: "tls",
      port: 443,
    });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("critical");
    expect(result.isQuantumVulnerable).toBe(true);
  });

  it("marks RSA-1024 as quantum_vulnerable status", () => {
    const item = makeItem({ algorithm: "RSA-1024", keyLength: 1024 });
    const result = analyzeQuantumRisk(item);
    expect(result.vulnerabilityStatus).toBe("quantum_vulnerable");
  });
});

// ── Test 2: RSA-2048 public TLS returns high ──────────────────────────────────

describe("Test 2: RSA-2048 on public TLS", () => {
  it("returns high risk level for RSA-2048 on public-facing TLS", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      assetType: "public_web_app",
      cryptoUsage: "tls",
      port: 443,
    });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("high");
  });

  it("marks RSA-2048 as quantum-vulnerable", () => {
    const item = makeItem({ algorithm: "RSA-2048" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(true);
  });

  it("does not mark RSA-2048 as critical (unlike RSA-1024)", () => {
    const item = makeItem({ algorithm: "RSA-2048", assetType: "public_web_app" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).not.toBe("critical");
  });
});

// ── Test 3: ECDSA public certificate returns high or medium ───────────────────

describe("Test 3: ECDSA on public certificate", () => {
  it("returns high for ECDSA on public-facing endpoint", () => {
    const item = makeItem({
      algorithm: "ECDSA-P256",
      assetType: "public_web_app",
      cryptoUsage: "tls",
    });
    const result = analyzeQuantumRisk(item);
    expect(["high", "medium"]).toContain(result.quantumRiskLevel);
    expect(result.quantumRiskLevel).toBe("high");
  });

  it("returns medium for ECDSA on internal non-TLS usage", () => {
    const item = makeItem({
      algorithm: "ECDSA-P256",
      assetType: "internal_service",
      cryptoUsage: "certificate",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("medium");
  });

  it("marks ECDSA as quantum-vulnerable", () => {
    const item = makeItem({ algorithm: "ECDSA-P256" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(true);
    expect(result.vulnerabilityStatus).toBe("quantum_vulnerable");
  });
});

// ── Test 4: ML-KEM returns low and isQuantumVulnerable false ─────────────────

describe("Test 4: ML-KEM quantum-resistant algorithm", () => {
  it("returns low risk level for ML-KEM-768", () => {
    const item = makeItem({ algorithm: "ML-KEM-768" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("low");
  });

  it("sets isQuantumVulnerable to false for ML-KEM", () => {
    const item = makeItem({ algorithm: "ML-KEM-768" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(false);
  });

  it("sets vulnerabilityStatus to quantum_resistant for ML-KEM", () => {
    const item = makeItem({ algorithm: "ML-KEM-768" });
    const result = analyzeQuantumRisk(item);
    expect(result.vulnerabilityStatus).toBe("quantum_resistant");
  });

  it("also marks CRYSTALS-Kyber as quantum_resistant", () => {
    const item = makeItem({ algorithm: "CRYSTALS-Kyber" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(false);
    expect(result.vulnerabilityStatus).toBe("quantum_resistant");
  });

  it("also marks ML-DSA as quantum_resistant", () => {
    const item = makeItem({ algorithm: "ML-DSA-65" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(false);
  });
});

// ── Test 5: Unknown algorithm returns unknown ─────────────────────────────────

describe("Test 5: Unknown algorithm", () => {
  it("returns unknown risk level for unrecognised algorithm", () => {
    const item = makeItem({ algorithm: "VENDOR-CUSTOM-ALGO-9000" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("unknown");
  });

  it("returns unknown vulnerabilityStatus for unrecognised algorithm", () => {
    const item = makeItem({ algorithm: "VENDOR-CUSTOM-ALGO-9000" });
    const result = analyzeQuantumRisk(item);
    expect(result.vulnerabilityStatus).toBe("unknown");
  });

  it("does not throw for empty string algorithm", () => {
    const item = makeItem({ algorithm: "" });
    expect(() => analyzeQuantumRisk(item)).not.toThrow();
  });
});

// ── Test 6: TLS 1.0 returns critical ─────────────────────────────────────────

describe("Test 6: TLS 1.0 deprecated version", () => {
  it("returns critical for TLS 1.0", () => {
    const item = makeItem({ algorithm: "RSA-2048", tlsVersion: "TLSv1.0" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("critical");
  });

  it("returns critical for TLS 1.1", () => {
    const item = makeItem({ algorithm: "RSA-2048", tlsVersion: "TLSv1.1" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("critical");
  });

  it("does not return critical for TLS 1.2 alone (high instead)", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      tlsVersion: "TLSv1.2",
      assetType: "api_gateway",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("high");
    expect(result.quantumRiskLevel).not.toBe("critical");
  });
});

// ── Test 7: Harvest-now risk for public VPN using RSA ────────────────────────

describe("Test 7: Harvest-now-decrypt-later exposure", () => {
  it("flags harvest-now risk for public VPN gateway using RSA", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      cryptoUsage: "vpn",
      assetType: "vpn_gateway",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.evidence["harvestNowDecryptLaterRisk"]).toBe(true);
  });

  it("flags harvest-now risk for public TLS with RSA", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      cryptoUsage: "tls",
      assetType: "public_web_app",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.evidence["harvestNowDecryptLaterRisk"]).toBe(true);
  });

  it("flags harvest-now for database encryption with RSA", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      cryptoUsage: "database_encryption",
      assetType: "database",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.evidence["harvestNowDecryptLaterRisk"]).toBe(true);
  });

  it("does NOT flag harvest-now for SSH usage (not a harvest-now vector)", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      cryptoUsage: "ssh",
      assetType: "jump_host",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.evidence["harvestNowDecryptLaterRisk"]).toBe(false);
  });

  it("does NOT flag harvest-now for quantum-resistant algorithms", () => {
    const item = makeItem({
      algorithm: "ML-KEM-768",
      cryptoUsage: "tls",
      assetType: "vpn_gateway",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.evidence["harvestNowDecryptLaterRisk"]).toBe(false);
  });
});

// ── Test 8: Readiness score = 0 for empty inventory ──────────────────────────

describe("Test 8: Readiness score with empty inventory", () => {
  it("returns score of 0 when no inventory exists", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID, SCAN_ID);
    expect(result.readinessScore).toBe(0);
  });

  it("returns critical recommended priority for empty inventory", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID);
    expect(result.recommendedPriority).toBe("critical");
  });

  it("includes explanation in summary for empty inventory", () => {
    const result = calculateQuantumReadinessScore([], CLIENT_ID);
    expect(result.summary.toLowerCase()).toContain("no cryptographic assets");
  });
});

// ── Test 9: Readiness score is clamped 0–100 ─────────────────────────────────

describe("Test 9: Readiness score clamping", () => {
  it("never goes below 0 with many critical findings", () => {
    const items = Array.from({ length: 20 }, () =>
      makeItem({ quantumRiskLevel: "critical", isQuantumVulnerable: true }),
    );
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBeGreaterThanOrEqual(0);
    expect(result.readinessScore).toBe(0);
  });

  it("never goes above 100 with all low-risk findings", () => {
    const items = Array.from({ length: 10 }, () =>
      makeItem({ quantumRiskLevel: "low", isQuantumVulnerable: false }),
    );
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBeLessThanOrEqual(100);
    expect(result.readinessScore).toBe(100);
  });

  it("score is exactly 88 for a single high-risk finding (100 - 12)", () => {
    const items = [makeItem({ quantumRiskLevel: "high", isQuantumVulnerable: true })];
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(88);
  });

  it("applies harvest-now penalty of 15 once only", () => {
    const items = [
      makeItem({ quantumRiskLevel: "high", isQuantumVulnerable: true, evidence: { harvestNowDecryptLaterRisk: true } }),
      makeItem({ quantumRiskLevel: "high", isQuantumVulnerable: true, evidence: { harvestNowDecryptLaterRisk: true } }),
    ];
    // 100 - 12 - 12 - 15 (once) = 61
    const result = calculateQuantumReadinessScore(items, CLIENT_ID);
    expect(result.readinessScore).toBe(61);
  });
});

// ── Test 10: Remediation planner deduplicates similar tasks ──────────────────

describe("Test 10: Remediation task deduplication", () => {
  it("deduplicates assessment-level tasks that would otherwise repeat", () => {
    // Multiple public TLS assets — should produce ONE "Prioritise PQC for public-facing" task
    const items = Array.from({ length: 5 }, (_, i) =>
      analyzeQuantumRisk(makeItem({
        algorithm: "RSA-2048",
        assetType: "vpn_gateway",
        cryptoUsage: "vpn",
        assetHostname: `vpn-gw-${i}.example.com`,
        evidence: { harvestNowDecryptLaterRisk: true },
      })),
    );
    const assessment = calculateQuantumReadinessScore(items, CLIENT_ID);
    const tasks = generateQuantumRemediationTasks(CLIENT_ID, assessment, items);

    // Count "Prioritise PQC migration for public-facing" tasks
    const publicFacingTasks = tasks.filter((t) =>
      t.title.toLowerCase().includes("public-facing"),
    );
    expect(publicFacingTasks.length).toBe(1);
  });

  it("deduplicates tasks with identical titles", () => {
    const items = Array.from({ length: 3 }, () =>
      analyzeQuantumRisk(makeItem({ algorithm: "RSA-2048", cryptoUsage: "tls" })),
    );
    const assessment = calculateQuantumReadinessScore(items, CLIENT_ID);
    const tasks = generateQuantumRemediationTasks(CLIENT_ID, assessment, items);

    const titles = tasks.map((t) => t.title);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);
  });

  it("all returned tasks have status open", () => {
    const items = [
      analyzeQuantumRisk(makeItem({ algorithm: "RSA-2048", cryptoUsage: "tls", assetType: "api_gateway" })),
    ];
    const assessment = calculateQuantumReadinessScore(items, CLIENT_ID);
    const tasks = generateQuantumRemediationTasks(CLIENT_ID, assessment, items);
    tasks.forEach((t) => expect(t.status).toBe("open"));
  });

  it("tasks are ordered with critical before high before medium before low", () => {
    const items = [
      analyzeQuantumRisk(makeItem({ algorithm: "RSA-1024", keyLength: 1024, cryptoUsage: "tls", assetType: "public_web_app" })),
      analyzeQuantumRisk(makeItem({ algorithm: "RSA-2048", cryptoUsage: "certificate" })),
    ];
    const assessment = calculateQuantumReadinessScore(items, CLIENT_ID);
    const tasks = generateQuantumRemediationTasks(CLIENT_ID, assessment, items);

    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
    for (let i = 1; i < tasks.length; i++) {
      const prev = priorityOrder[tasks[i - 1].priority] ?? 4;
      const curr = priorityOrder[tasks[i].priority] ?? 4;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });
});

// ── Bonus: analyzeQuantumRisk immutability ────────────────────────────────────

describe("analyzeQuantumRisk immutability", () => {
  it("does not mutate the original item", () => {
    const original = makeItem({ algorithm: "RSA-2048", cryptoUsage: "tls" });
    const snapshot = JSON.stringify(original);
    analyzeQuantumRisk(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
