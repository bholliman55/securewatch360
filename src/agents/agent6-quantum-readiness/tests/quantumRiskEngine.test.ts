/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Tests for quantumRiskEngine — algorithm classification and risk analysis.
 */

import {
  analyzeQuantumRisk,
  isQuantumVulnerableAlgorithm,
  isQuantumResistantAlgorithm,
  normalizeAlgorithmName,
  detectHarvestNowDecryptLaterRisk,
  getAlgorithmProfile,
} from "../quantumRiskEngine";
import type { CryptoInventoryItem } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CryptoInventoryItem>): CryptoInventoryItem {
  return {
    clientId: "test-client-001",
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

// ── normalizeAlgorithmName ────────────────────────────────────────────────────

describe("normalizeAlgorithmName", () => {
  it("normalizes RSA cipher suite strings", () => {
    expect(normalizeAlgorithmName("TLS_RSA_WITH_AES_128_CBC_SHA")).toBe("RSA-2048");
    expect(normalizeAlgorithmName("RSA/ECB/PKCS1Padding")).toBe("RSA-2048");
    expect(normalizeAlgorithmName("RSA-4096")).toBe("RSA-4096");
    expect(normalizeAlgorithmName("rsa-1024")).toBe("RSA-1024");
  });

  it("normalizes ECDSA variants", () => {
    expect(normalizeAlgorithmName("ES256")).toBe("ECDSA-P256");
    expect(normalizeAlgorithmName("ECDSA-P384")).toBe("ECDSA-P384");
    expect(normalizeAlgorithmName("ES384")).toBe("ECDSA-P384");
  });

  it("normalizes PQC algorithm strings", () => {
    expect(normalizeAlgorithmName("CRYSTALS-Kyber")).toBe("ML-KEM");
    expect(normalizeAlgorithmName("ML-KEM-768")).toBe("ML-KEM-768");
    expect(normalizeAlgorithmName("CRYSTALS-Dilithium")).toBe("ML-DSA");
    expect(normalizeAlgorithmName("SPHINCS+")).toBe("SLH-DSA");
    expect(normalizeAlgorithmName("FALCON-512")).toBe("FN-DSA");
  });

  it("normalizes hash functions", () => {
    expect(normalizeAlgorithmName("SHA1")).toBe("SHA-1");
    expect(normalizeAlgorithmName("SHA-256")).toBe("SHA-256");
    expect(normalizeAlgorithmName("SHA-512")).toBe("SHA-512");
    expect(normalizeAlgorithmName("MD5")).toBe("MD5");
  });

  it("normalizes symmetric algorithms", () => {
    expect(normalizeAlgorithmName("AES128")).toBe("AES-128");
    expect(normalizeAlgorithmName("AES-256-GCM")).toBe("AES-256");
    expect(normalizeAlgorithmName("3DES")).toBe("3DES");
    expect(normalizeAlgorithmName("RC4")).toBe("RC4");
  });

  it("returns original string for unknown algorithms", () => {
    const result = normalizeAlgorithmName("VENDOR-PROPRIETARY-9000");
    expect(result).toBe("VENDOR-PROPRIETARY-9000");
  });
});

// ── isQuantumVulnerableAlgorithm ──────────────────────────────────────────────

describe("isQuantumVulnerableAlgorithm", () => {
  const vulnerable = ["RSA-2048", "RSA-1024", "ECDSA", "ECDH", "ECC", "DSA", "DH", "Diffie-Hellman"];
  const resistant = ["ML-KEM-768", "CRYSTALS-Kyber", "ML-DSA-65", "SPHINCS+", "FALCON", "LMS", "XMSS"];
  const neutral = ["AES-256", "SHA-512"];

  vulnerable.forEach((alg) => {
    it(`correctly identifies ${alg} as quantum-vulnerable`, () => {
      expect(isQuantumVulnerableAlgorithm(alg)).toBe(true);
    });
  });

  resistant.forEach((alg) => {
    it(`correctly identifies ${alg} as NOT quantum-vulnerable`, () => {
      expect(isQuantumVulnerableAlgorithm(alg)).toBe(false);
    });
  });

  neutral.forEach((alg) => {
    it(`correctly identifies ${alg} as not in vulnerable set`, () => {
      expect(isQuantumVulnerableAlgorithm(alg)).toBe(false);
    });
  });
});

// ── isQuantumResistantAlgorithm ───────────────────────────────────────────────

describe("isQuantumResistantAlgorithm", () => {
  it("returns true for NIST PQC algorithms", () => {
    expect(isQuantumResistantAlgorithm("ML-KEM-768")).toBe(true);
    expect(isQuantumResistantAlgorithm("CRYSTALS-Kyber")).toBe(true);
    expect(isQuantumResistantAlgorithm("ML-DSA-65")).toBe(true);
    expect(isQuantumResistantAlgorithm("CRYSTALS-Dilithium")).toBe(true);
    expect(isQuantumResistantAlgorithm("SPHINCS+")).toBe(true);
    expect(isQuantumResistantAlgorithm("FALCON")).toBe(true);
    expect(isQuantumResistantAlgorithm("LMS")).toBe(true);
    expect(isQuantumResistantAlgorithm("XMSS")).toBe(true);
  });

  it("returns false for classical algorithms", () => {
    expect(isQuantumResistantAlgorithm("RSA-2048")).toBe(false);
    expect(isQuantumResistantAlgorithm("ECDSA")).toBe(false);
    expect(isQuantumResistantAlgorithm("AES-256")).toBe(false);
    expect(isQuantumResistantAlgorithm("SHA-512")).toBe(false);
  });
});

// ── detectHarvestNowDecryptLaterRisk ──────────────────────────────────────────

describe("detectHarvestNowDecryptLaterRisk", () => {
  it("detects risk for public-facing TLS with vulnerable algorithm", () => {
    const item = makeItem({
      cryptoUsage: "tls",
      assetType: "public_web_app",
      algorithm: "RSA-2048",
      isQuantumVulnerable: true,
    });
    expect(detectHarvestNowDecryptLaterRisk(item)).toBe(true);
  });

  it("detects risk for VPN with vulnerable algorithm", () => {
    const item = makeItem({
      cryptoUsage: "vpn",
      algorithm: "ECDH-P256",
      isQuantumVulnerable: true,
    });
    expect(detectHarvestNowDecryptLaterRisk(item)).toBe(true);
  });

  it("detects risk for database encryption with vulnerable algorithm", () => {
    const item = makeItem({
      cryptoUsage: "database_encryption",
      assetType: "database",
      algorithm: "RSA-2048",
      isQuantumVulnerable: true,
    });
    expect(detectHarvestNowDecryptLaterRisk(item)).toBe(true);
  });

  it("does not flag SSH (non-harvest-now usage) even with vulnerable algorithm", () => {
    const item = makeItem({
      cryptoUsage: "ssh",
      algorithm: "RSA-2048",
      isQuantumVulnerable: true,
    });
    expect(detectHarvestNowDecryptLaterRisk(item)).toBe(false);
  });

  it("does not flag quantum-resistant algorithm regardless of usage", () => {
    const item = makeItem({
      cryptoUsage: "tls",
      assetType: "public_web_app",
      algorithm: "ML-KEM-768",
      isQuantumVulnerable: false,
    });
    expect(detectHarvestNowDecryptLaterRisk(item)).toBe(false);
  });
});

// ── analyzeQuantumRisk ────────────────────────────────────────────────────────

describe("analyzeQuantumRisk", () => {
  it("does not mutate the original item", () => {
    const original = makeItem({ algorithm: "RSA-2048", cryptoUsage: "tls" });
    const originalJson = JSON.stringify(original);
    analyzeQuantumRisk(original);
    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it("marks RSA-2048 as quantum-vulnerable", () => {
    const item = makeItem({ algorithm: "RSA-2048" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(true);
    expect(result.vulnerabilityStatus).toBe("quantum_vulnerable");
  });

  it("marks ML-KEM-768 as quantum-resistant", () => {
    const item = makeItem({ algorithm: "ML-KEM-768" });
    const result = analyzeQuantumRisk(item);
    expect(result.isQuantumVulnerable).toBe(false);
    expect(result.vulnerabilityStatus).toBe("quantum_resistant");
    expect(result.quantumRiskLevel).toBe("low");
  });

  it("assigns critical risk for TLS 1.0", () => {
    const item = makeItem({ algorithm: "RSA-2048", tlsVersion: "TLSv1.0" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("critical");
  });

  it("assigns critical risk for TLS 1.1", () => {
    const item = makeItem({ algorithm: "RSA-2048", tlsVersion: "TLSv1.1" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("critical");
  });

  it("assigns high risk for RSA on public-facing TLS", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      assetType: "public_web_app",
      cryptoUsage: "tls",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("high");
  });

  it("assigns high risk for RSA on TLS 1.2", () => {
    const item = makeItem({ algorithm: "RSA-2048", tlsVersion: "TLSv1.2", assetType: "api_gateway" });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("high");
  });

  it("assigns medium risk for internal RSA usage", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      cryptoUsage: "ssh",
      assetType: "jump_host",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.quantumRiskLevel).toBe("medium");
  });

  it("assigns unknown risk for unrecognised algorithms", () => {
    const item = makeItem({ algorithm: "VENDOR-CUSTOM-9000" });
    const result = analyzeQuantumRisk(item);
    expect(result.vulnerabilityStatus).toBe("unknown");
    expect(result.quantumRiskLevel).toBe("unknown");
  });

  it("populates evidence with harvestNowDecryptLaterRisk", () => {
    const item = makeItem({
      algorithm: "RSA-2048",
      cryptoUsage: "tls",
      assetType: "public_web_app",
    });
    const result = analyzeQuantumRisk(item);
    expect(result.evidence["harvestNowDecryptLaterRisk"]).toBe(true);
  });

  it("populates evidence with recommended replacements", () => {
    const item = makeItem({ algorithm: "RSA-2048" });
    const result = analyzeQuantumRisk(item);
    const replacements = result.evidence["recommendedReplacements"] as string[];
    expect(Array.isArray(replacements)).toBe(true);
    expect(replacements.length).toBeGreaterThan(0);
  });
});

// ── getAlgorithmProfile ───────────────────────────────────────────────────────

describe("getAlgorithmProfile", () => {
  it("returns correct profile for RSA-2048", () => {
    const profile = getAlgorithmProfile("RSA-2048");
    expect(profile.vulnerabilityLevel).toBe("critical");
    expect(profile.isNistApproved).toBe(false);
    expect(profile.attackVectors).toContain("shor");
  });

  it("returns correct NIST standard for ML-KEM-768", () => {
    const profile = getAlgorithmProfile("ML-KEM-768");
    expect(profile.vulnerabilityLevel).toBe("none");
    expect(profile.isNistApproved).toBe(true);
    expect(profile.nistPqcStandard).toBe("FIPS 203");
  });

  it("returns a fallback profile for unknown algorithms", () => {
    const profile = getAlgorithmProfile("UNKNOWN-ALG-99");
    expect(profile.algorithmId).toBe("UNKNOWN-ALG-99");
    expect(profile.family).toBe("unknown");
    expect(profile.vulnerabilityLevel).toBe("high");
  });
});
