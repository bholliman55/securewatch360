/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Core risk engine: algorithm classification and per-asset quantum risk analysis.
 */

import type {
  CryptoInventoryItem,
  QuantumRiskLevel,
  QuantumVulnerabilityStatus,
  QuantumAlgorithmProfile,
  QuantumVulnerabilityLevel,
  AlgorithmFamily,
} from "./types";

// ── Algorithm Classification ──────────────────────────────────────────────────

const QUANTUM_VULNERABLE_ALGORITHMS = new Set([
  "RSA", "RSA-1024", "RSA-2048", "RSA-3072", "RSA-4096",
  "ECDSA", "ECDH", "ECC",
  "DSA", "DH", "DIFFIE-HELLMAN",
]);

const QUANTUM_RESISTANT_ALGORITHMS = new Set([
  "ML-KEM", "ML-DSA", "SLH-DSA",
  "SPHINCS+", "SPHINCS",
  "CRYSTALS-KYBER", "KYBER",
  "CRYSTALS-DILITHIUM", "DILITHIUM",
  "FALCON", "FN-DSA",
  "LMS", "XMSS",
  "ML-KEM-512", "ML-KEM-768", "ML-KEM-1024",
  "ML-DSA-44", "ML-DSA-65", "ML-DSA-87",
  "FN-DSA-512", "FN-DSA-1024",
  "SLH-DSA-128S", "SLH-DSA-128F",
]);

const HARVEST_NOW_USAGE_TYPES = new Set([
  "tls", "vpn", "email_encryption", "database_encryption", "api_authentication",
]);

const HARVEST_NOW_ASSET_TYPES = new Set([
  "public_web_app", "vpn_gateway", "database", "identity_provider",
  "email_gateway", "api_gateway",
]);

// ── Algorithm Profiles (database) ─────────────────────────────────────────────

const ALGORITHM_PROFILES: Record<string, QuantumAlgorithmProfile> = {
  "RSA-1024": buildProfile("RSA-1024", "RSA 1024-bit", "asymmetric-classical", 1024, "critical", 5, false, ["ML-KEM-768", "ML-DSA-65"], ["shor", "harvest-now-decrypt-later"]),
  "RSA-2048": buildProfile("RSA-2048", "RSA 2048-bit", "asymmetric-classical", 2048, "critical", 10, false, ["ML-KEM-768", "ML-DSA-65"], ["shor", "harvest-now-decrypt-later"]),
  "RSA-3072": buildProfile("RSA-3072", "RSA 3072-bit", "asymmetric-classical", 3072, "critical", 12, false, ["ML-KEM-1024", "ML-DSA-87"], ["shor", "harvest-now-decrypt-later"]),
  "RSA-4096": buildProfile("RSA-4096", "RSA 4096-bit", "asymmetric-classical", 4096, "critical", 15, false, ["ML-KEM-1024", "ML-DSA-87"], ["shor", "harvest-now-decrypt-later"]),
  "ECDSA-P256": buildProfile("ECDSA-P256", "ECDSA P-256", "asymmetric-classical", 256, "critical", 10, false, ["ML-DSA-44", "FN-DSA-512"], ["shor", "harvest-now-decrypt-later"]),
  "ECDSA-P384": buildProfile("ECDSA-P384", "ECDSA P-384", "asymmetric-classical", 384, "critical", 12, false, ["ML-DSA-65", "FN-DSA-1024"], ["shor", "harvest-now-decrypt-later"]),
  "ECDH-P256": buildProfile("ECDH-P256", "ECDH P-256", "asymmetric-classical", 256, "critical", 10, false, ["ML-KEM-512", "ML-KEM-768"], ["shor", "harvest-now-decrypt-later"]),
  "DH-2048": buildProfile("DH-2048", "Diffie-Hellman 2048-bit", "asymmetric-classical", 2048, "critical", 10, false, ["ML-KEM-768"], ["shor"]),
  "DSA-2048": buildProfile("DSA-2048", "DSA 2048-bit", "asymmetric-classical", 2048, "critical", 10, false, ["ML-DSA-65"], ["shor"]),
  "AES-128": buildProfile("AES-128", "AES 128-bit", "symmetric", 128, "high", 10, false, ["AES-256"], ["grover"]),
  "AES-256": buildProfile("AES-256", "AES 256-bit", "symmetric", 256, "low", null, true, [], []),
  "3DES": buildProfile("3DES", "Triple DES", "symmetric", 112, "critical", 5, false, ["AES-256"], ["grover", "classical-brute-force"]),
  "RC4": buildProfile("RC4", "RC4", "symmetric", 128, "critical", 5, false, ["AES-256"], ["classical-attack", "grover"]),
  "SHA-1": buildProfile("SHA-1", "SHA-1", "hash", undefined, "critical", 5, false, ["SHA-384", "SHA-512"], ["grover", "classical-collision"]),
  "MD5": buildProfile("MD5", "MD5", "hash", undefined, "critical", 5, false, ["SHA-384", "SHA-512"], ["grover", "classical-collision"]),
  "SHA-256": buildProfile("SHA-256", "SHA-256", "hash", undefined, "medium", 15, true, ["SHA-384", "SHA-512"], ["grover"]),
  "SHA-384": buildProfile("SHA-384", "SHA-384", "hash", undefined, "low", null, true, [], []),
  "SHA-512": buildProfile("SHA-512", "SHA-512", "hash", undefined, "low", null, true, [], []),
  "ML-KEM-512": buildProfile("ML-KEM-512", "ML-KEM-512 (CRYSTALS-Kyber)", "pqc-kem", 800, "none", null, true, [], [], "FIPS 203"),
  "ML-KEM-768": buildProfile("ML-KEM-768", "ML-KEM-768 (CRYSTALS-Kyber)", "pqc-kem", 1184, "none", null, true, [], [], "FIPS 203"),
  "ML-KEM-1024": buildProfile("ML-KEM-1024", "ML-KEM-1024 (CRYSTALS-Kyber)", "pqc-kem", 1568, "none", null, true, [], [], "FIPS 203"),
  "ML-DSA-44": buildProfile("ML-DSA-44", "ML-DSA-44 (CRYSTALS-Dilithium)", "pqc-signature", undefined, "none", null, true, [], [], "FIPS 204"),
  "ML-DSA-65": buildProfile("ML-DSA-65", "ML-DSA-65 (CRYSTALS-Dilithium)", "pqc-signature", undefined, "none", null, true, [], [], "FIPS 204"),
  "ML-DSA-87": buildProfile("ML-DSA-87", "ML-DSA-87 (CRYSTALS-Dilithium)", "pqc-signature", undefined, "none", null, true, [], [], "FIPS 204"),
  "FN-DSA-512": buildProfile("FN-DSA-512", "FN-DSA-512 (FALCON)", "pqc-signature", undefined, "none", null, true, [], [], "FIPS 206"),
  "FN-DSA-1024": buildProfile("FN-DSA-1024", "FN-DSA-1024 (FALCON)", "pqc-signature", undefined, "none", null, true, [], [], "FIPS 206"),
  "SLH-DSA-128s": buildProfile("SLH-DSA-128s", "SLH-DSA-128s (SPHINCS+)", "pqc-signature", undefined, "none", null, true, [], [], "FIPS 205"),
};

function buildProfile(
  algorithmId: string,
  name: string,
  family: AlgorithmFamily,
  keyLengthBits: number | undefined,
  vulnerabilityLevel: QuantumVulnerabilityLevel,
  estimatedYearsToThreat: number | null,
  isNistApproved: boolean,
  recommendedReplacements: string[],
  attackVectors: string[],
  nistPqcStandard?: string,
): QuantumAlgorithmProfile {
  return {
    algorithmId,
    name,
    family,
    keyLengthBits,
    vulnerabilityLevel,
    estimatedYearsToThreat,
    nistPqcStandard,
    isNistApproved,
    recommendedReplacements,
    attackVectors,
    cveReferences: [],
  };
}

// ── Public Helpers ────────────────────────────────────────────────────────────

export function normalizeAlgorithmName(raw: string): string {
  const upper = raw.trim().toUpperCase();

  // PQC families
  if (upper.includes("ML-KEM") || upper.includes("KYBER")) return "ML-KEM";
  if (upper.includes("ML-DSA") || upper.includes("DILITHIUM")) return "ML-DSA";
  if (upper.includes("FALCON") || upper.includes("FN-DSA")) return "FN-DSA";
  if (upper.includes("SPHINCS") || upper.includes("SLH-DSA")) return "SLH-DSA";
  if (upper === "LMS" || upper === "XMSS") return upper;

  // Classical asymmetric
  if (upper.includes("RSA")) {
    if (upper.includes("4096")) return "RSA-4096";
    if (upper.includes("3072")) return "RSA-3072";
    if (upper.includes("1024")) return "RSA-1024";
    return "RSA-2048";
  }
  if (upper.includes("ECDSA") || upper.includes("ES256") || upper.includes("ES384")) {
    return upper.includes("384") ? "ECDSA-P384" : "ECDSA-P256";
  }
  if (upper.includes("ECDH")) return "ECDH-P256";
  if (upper.includes("DIFFIE-HELLMAN") || upper.includes("DH-") || upper === "DH") return "DH-2048";
  if (upper.includes("DSA")) return "DSA-2048";
  if (upper.includes("ECC")) return "ECDSA-P256";

  // Symmetric
  if (upper.includes("3DES") || upper.includes("TRIPLE")) return "3DES";
  if (upper.includes("RC4")) return "RC4";
  if (upper.includes("AES-256") || upper.includes("AES256")) return "AES-256";
  if (upper.includes("AES-128") || upper.includes("AES128") || upper.includes("AES")) return "AES-128";

  // Hash
  if (upper === "SHA1" || upper === "SHA-1") return "SHA-1";
  if (upper === "MD5") return "MD5";
  if (upper.includes("SHA-512") || upper.includes("SHA512")) return "SHA-512";
  if (upper.includes("SHA-384") || upper.includes("SHA384")) return "SHA-384";
  if (upper.includes("SHA-256") || upper.includes("SHA256")) return "SHA-256";

  return raw;
}

export function isQuantumVulnerableAlgorithm(algorithm: string): boolean {
  const normalized = normalizeAlgorithmName(algorithm).toUpperCase();
  // Check against the set (which uses uppercase keys)
  if (QUANTUM_VULNERABLE_ALGORITHMS.has(normalized)) return true;
  // Also check base family names (e.g. "RSA-2048" should match "RSA")
  for (const vuln of QUANTUM_VULNERABLE_ALGORITHMS) {
    if (normalized.startsWith(vuln)) return true;
  }
  return false;
}

export function isQuantumResistantAlgorithm(algorithm: string): boolean {
  const normalized = normalizeAlgorithmName(algorithm).toUpperCase();
  if (QUANTUM_RESISTANT_ALGORITHMS.has(normalized)) return true;
  for (const safe of QUANTUM_RESISTANT_ALGORITHMS) {
    if (normalized.startsWith(safe)) return true;
  }
  return false;
}

export function detectHarvestNowDecryptLaterRisk(item: CryptoInventoryItem): boolean {
  const usageMatch = HARVEST_NOW_USAGE_TYPES.has(item.cryptoUsage);
  const assetMatch = item.assetType ? HARVEST_NOW_ASSET_TYPES.has(item.assetType) : false;
  const algorithmVulnerable = isQuantumVulnerableAlgorithm(item.algorithm);

  return (usageMatch || assetMatch) && algorithmVulnerable;
}

export function getAlgorithmProfile(algorithmId: string): QuantumAlgorithmProfile {
  const normalized = normalizeAlgorithmName(algorithmId);
  return ALGORITHM_PROFILES[normalized] ?? unknownProfile(algorithmId);
}

export function getAllAlgorithmProfiles(): QuantumAlgorithmProfile[] {
  return Object.values(ALGORITHM_PROFILES);
}

// ── Risk Analysis ─────────────────────────────────────────────────────────────

/**
 * Enriches a CryptoInventoryItem with quantum risk fields.
 * Returns a new object — does not mutate the original.
 */
export function analyzeQuantumRisk(item: CryptoInventoryItem): CryptoInventoryItem {
  const isVulnerable = isQuantumVulnerableAlgorithm(item.algorithm);
  const isResistant = isQuantumResistantAlgorithm(item.algorithm);

  const vulnerabilityStatus = deriveVulnerabilityStatus(isVulnerable, isResistant);
  const quantumRiskLevel = deriveRiskLevel(item, isVulnerable, isResistant);
  const harvestNow = detectHarvestNowDecryptLaterRisk(item);

  const enrichedEvidence: Record<string, unknown> = {
    ...item.evidence,
    harvestNowDecryptLaterRisk: harvestNow,
    quantumAnalysisVersion: "1.0",
    normalizedAlgorithm: normalizeAlgorithmName(item.algorithm),
    attackVectors: getAlgorithmProfile(item.algorithm).attackVectors,
    recommendedReplacements: getAlgorithmProfile(item.algorithm).recommendedReplacements,
  };

  return {
    ...item,
    isQuantumVulnerable: isVulnerable,
    quantumRiskLevel,
    vulnerabilityStatus,
    evidence: enrichedEvidence,
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function deriveVulnerabilityStatus(
  isVulnerable: boolean,
  isResistant: boolean,
): QuantumVulnerabilityStatus {
  if (isVulnerable && !isResistant) return "quantum_vulnerable";
  if (!isVulnerable && isResistant) return "quantum_resistant";
  if (isVulnerable && isResistant) return "hybrid";
  return "unknown";
}

function deriveRiskLevel(
  item: CryptoInventoryItem,
  isVulnerable: boolean,
  isResistant: boolean,
): QuantumRiskLevel {
  if (!isVulnerable && isResistant) return "low";
  if (!isVulnerable && !isResistant) return "unknown";

  const normalizedAlg = normalizeAlgorithmName(item.algorithm).toUpperCase();

  // Explicitly critical: weak TLS or sub-2048 RSA
  if (item.tlsVersion === "TLSv1.0" || item.tlsVersion === "TLSv1.1") return "critical";
  if (normalizedAlg === "RSA-1024") return "critical";
  if (normalizedAlg === "3DES" || normalizedAlg === "RC4") return "critical";
  if (normalizedAlg === "SHA-1" || normalizedAlg === "MD5") return "critical";

  const isTls12 = item.tlsVersion === "TLSv1.2";
  const isTls13 = item.tlsVersion === "TLSv1.3";
  const isPublicFacing =
    item.assetType === "public_web_app" ||
    item.assetType === "api_gateway" ||
    item.cryptoUsage === "tls";

  // TLS 1.2 with classical key exchange — still vulnerable to HNDL
  if (isTls12 && isVulnerable && isPublicFacing) return "high";

  // TLS 1.3 forward secrecy helps, but certificate is still classically signed
  if (isTls13 && isVulnerable && isPublicFacing) return "high";

  // Public-facing RSA/ECC
  if (isPublicFacing && isVulnerable) return "high";

  // Internal usage: lower urgency unless long-lived sensitive
  return "medium";
}

function unknownProfile(algorithmId: string): QuantumAlgorithmProfile {
  return {
    algorithmId,
    name: algorithmId,
    family: "unknown",
    vulnerabilityLevel: "high",
    estimatedYearsToThreat: 10,
    isNistApproved: false,
    recommendedReplacements: ["ML-KEM-768", "ML-DSA-65"],
    attackVectors: ["unknown"],
    cveReferences: [],
  };
}
