/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Maps cryptographic findings to compliance framework controls and generates
 * QuantumPolicyResult records for policy-as-code evaluation.
 */

import type {
  CryptoInventoryItem,
  QuantumPolicyResult,
  QuantumPolicyMapping,
  QuantumRiskLevel,
} from "./types";

// ── Control Mapping Database ──────────────────────────────────────────────────

interface ControlMapping {
  framework: string;
  controlId: string;
  controlTitle: string;
  applicability: "required" | "recommended" | "emerging";
  triggersWhen: (item: CryptoInventoryItem) => boolean;
  gapMessage: string;
}

const CONTROL_MAPPINGS: ControlMapping[] = [
  // NIST SP 800-131A / NIST PQC Migration
  {
    framework: "NIST SP 800-131A",
    controlId: "SC-13",
    controlTitle: "Cryptographic Protection",
    applicability: "required",
    triggersWhen: (i) => i.isQuantumVulnerable,
    gapMessage: "Asset uses a quantum-vulnerable algorithm not approved for long-term use under NIST SP 800-131A.",
  },
  {
    framework: "NIST SP 800-208",
    controlId: "PQC-1",
    controlTitle: "Post-Quantum Cryptography Migration",
    applicability: "emerging",
    triggersWhen: (i) => i.isQuantumVulnerable && i.quantumRiskLevel !== "low",
    gapMessage: "Asset has not initiated migration to NIST PQC standards (FIPS 203/204/205).",
  },
  // CMMC 2.0
  {
    framework: "CMMC 2.0",
    controlId: "SC.3.177",
    controlTitle: "Employ FIPS-validated cryptography",
    applicability: "required",
    triggersWhen: (i) => i.isQuantumVulnerable && !i.evidence?.["nistApproved"],
    gapMessage: "Asset employs non-FIPS-validated cryptography vulnerable to quantum attack.",
  },
  // HIPAA
  {
    framework: "HIPAA",
    controlId: "164.312(a)(2)(iv)",
    controlTitle: "Encryption and Decryption",
    applicability: "recommended",
    triggersWhen: (i) =>
      i.isQuantumVulnerable &&
      (i.cryptoUsage === "database_encryption" || i.cryptoUsage === "email_encryption"),
    gapMessage: "PHI encrypted with quantum-vulnerable algorithm; risk of future decryption if data is harvested.",
  },
  // SOC 2
  {
    framework: "SOC 2",
    controlId: "CC6.1",
    controlTitle: "Logical and Physical Access Controls — Encryption",
    applicability: "required",
    triggersWhen: (i) => i.isQuantumVulnerable && i.quantumRiskLevel !== "low",
    gapMessage: "Cryptographic control does not meet quantum-resilience expectations.",
  },
  // ISO 27001:2022
  {
    framework: "ISO 27001:2022",
    controlId: "A.8.24",
    controlTitle: "Use of Cryptography",
    applicability: "required",
    triggersWhen: (i) => i.isQuantumVulnerable,
    gapMessage: "Cryptographic algorithm lacks quantum resistance — non-compliant with updated A.8.24 guidance.",
  },
  // PCI DSS v4.0
  {
    framework: "PCI DSS v4.0",
    controlId: "4.2.1",
    controlTitle: "Strong Cryptography for Data in Transit",
    applicability: "required",
    triggersWhen: (i) =>
      i.isQuantumVulnerable &&
      (i.cryptoUsage === "tls" || i.cryptoUsage === "api_authentication"),
    gapMessage: "Cardholder data in transit protected by quantum-vulnerable cryptography.",
  },
  {
    framework: "PCI DSS v4.0",
    controlId: "3.5.1",
    controlTitle: "Primary Account Number Protection — Cryptography",
    applicability: "required",
    triggersWhen: (i) => i.isQuantumVulnerable && i.cryptoUsage === "database_encryption",
    gapMessage: "PAN storage encryption uses quantum-vulnerable algorithm.",
  },
  // FedRAMP
  {
    framework: "FedRAMP",
    controlId: "SC-13",
    controlTitle: "Cryptographic Protection — FIPS 140 Validated",
    applicability: "required",
    triggersWhen: (i) => i.isQuantumVulnerable,
    gapMessage: "FedRAMP systems must use FIPS 140-validated modules; quantum-vulnerable algorithms not compliant.",
  },
  // TLS-specific (cross-framework)
  {
    framework: "NIST SP 800-52",
    controlId: "TLS-VERS",
    controlTitle: "TLS Version Requirements",
    applicability: "required",
    triggersWhen: (i) => i.tlsVersion === "TLSv1.0" || i.tlsVersion === "TLSv1.1",
    gapMessage: "TLS 1.0/1.1 is prohibited by NIST SP 800-52 Rev. 2.",
  },
  // Harvest-Now risk
  {
    framework: "NIST IR 8413",
    controlId: "HNDL-1",
    controlTitle: "Harvest-Now-Decrypt-Later Risk Mitigation",
    applicability: "emerging",
    triggersWhen: (i) => i.evidence?.["harvestNowDecryptLaterRisk"] === true,
    gapMessage: "Asset is exposed to harvest-now-decrypt-later attacks; long-term data confidentiality at risk.",
  },
];

// ── Policy Evaluation ─────────────────────────────────────────────────────────

/** Maps finding categories to internal policy IDs. */
const POLICY_RULES: Array<{
  policyId: string;
  policyName: string;
  severity: QuantumRiskLevel;
  evaluate: (item: CryptoInventoryItem) => { passed: boolean; message: string };
}> = [
  {
    policyId: "QCP-001",
    policyName: "No RSA below 2048 bits",
    severity: "critical",
    evaluate: (item) => {
      const alg = item.algorithm.toUpperCase();
      const passed = !(alg.includes("RSA-1024") || (alg.includes("RSA") && item.keyLength !== undefined && item.keyLength < 2048));
      return { passed, message: passed ? "RSA key length meets minimum requirements." : "RSA key length is below 2048 bits — immediately vulnerable." };
    },
  },
  {
    policyId: "QCP-002",
    policyName: "No deprecated hash algorithms (MD5, SHA-1)",
    severity: "critical",
    evaluate: (item) => {
      const alg = item.algorithm.toUpperCase();
      const passed = !alg.includes("MD5") && !alg.includes("SHA-1") && !alg.includes("SHA1");
      return { passed, message: passed ? "Hash algorithm is acceptable." : "MD5 or SHA-1 detected — cryptographically broken." };
    },
  },
  {
    policyId: "QCP-003",
    policyName: "No TLS 1.0 or 1.1",
    severity: "critical",
    evaluate: (item) => {
      const passed = item.tlsVersion !== "TLSv1.0" && item.tlsVersion !== "TLSv1.1";
      return { passed, message: passed ? "TLS version is acceptable." : `${item.tlsVersion} is deprecated and must be disabled.` };
    },
  },
  {
    policyId: "QCP-004",
    policyName: "Warn RSA/ECC usage on public-facing assets",
    severity: "high",
    evaluate: (item) => {
      const alg = item.algorithm.toUpperCase();
      const isClassical = alg.includes("RSA") || alg.includes("ECC") || alg.includes("ECDSA") || alg.includes("ECDH");
      const isPublic = item.assetType === "public_web_app" || item.assetType === "api_gateway" || item.cryptoUsage === "tls";
      const passed = !(isClassical && isPublic);
      return {
        passed,
        message: passed
          ? "No classical asymmetric algorithm detected on public-facing asset."
          : `${item.algorithm} on public-facing asset is quantum-vulnerable. Plan migration to ML-KEM or ML-DSA.`,
      };
    },
  },
  {
    policyId: "QCP-005",
    policyName: "Harvest-now-decrypt-later exposure",
    severity: "high",
    evaluate: (item) => {
      const passed = item.evidence?.["harvestNowDecryptLaterRisk"] !== true;
      return {
        passed,
        message: passed
          ? "No harvest-now-decrypt-later risk detected."
          : "Asset is exposed to harvest-now-decrypt-later attacks. Urgent PQC migration recommended.",
      };
    },
  },
  {
    policyId: "QCP-006",
    policyName: "TLS 1.2 with classical key exchange",
    severity: "high",
    evaluate: (item) => {
      const alg = item.algorithm.toUpperCase();
      const isClassical = alg.includes("RSA") || alg.includes("ECDSA") || alg.includes("ECDH");
      const isTls12 = item.tlsVersion === "TLSv1.2";
      const passed = !(isTls12 && isClassical);
      return {
        passed,
        message: passed
          ? "TLS 1.2 configuration does not rely on quantum-vulnerable key exchange."
          : "TLS 1.2 with RSA/ECC key exchange is quantum-vulnerable. Upgrade to TLS 1.3 with PQC hybrid.",
      };
    },
  },
  {
    policyId: "QCP-007",
    policyName: "PQC adoption validated",
    severity: "low",
    evaluate: (item) => {
      const alg = item.algorithm.toUpperCase();
      const isPqc = alg.includes("ML-KEM") || alg.includes("ML-DSA") || alg.includes("SLH-DSA") ||
        alg.includes("KYBER") || alg.includes("DILITHIUM") || alg.includes("FALCON") ||
        alg.includes("FN-DSA") || alg.includes("LMS") || alg.includes("XMSS");
      return {
        passed: isPqc,
        message: isPqc
          ? "Asset uses a NIST-approved post-quantum algorithm."
          : "Asset has not adopted a post-quantum algorithm.",
      };
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluates each inventory item against internal policy rules and returns
 * QuantumPolicyResult records for storage and reporting.
 */
export function evaluatePolicies(
  items: CryptoInventoryItem[],
  clientId: string,
): QuantumPolicyResult[] {
  const results: QuantumPolicyResult[] = [];

  for (const item of items) {
    for (const rule of POLICY_RULES) {
      const { passed, message } = rule.evaluate(item);
      results.push({
        clientId,
        inventoryId: item.id,
        policyId: rule.policyId,
        policyName: rule.policyName,
        passed,
        severity: rule.severity,
        message,
        evidence: {
          algorithm: item.algorithm,
          tlsVersion: item.tlsVersion,
          assetType: item.assetType,
          cryptoUsage: item.cryptoUsage,
          keyLength: item.keyLength,
        },
      });
    }
  }

  return results;
}

/**
 * Maps inventory items to compliance framework controls.
 * Returns gap entries for non-compliant items only.
 */
export function mapToFrameworkControls(
  items: CryptoInventoryItem[],
  frameworks?: string[],
): QuantumPolicyMapping[] {
  const mappings: QuantumPolicyMapping[] = [];
  const frameworkFilter = frameworks && frameworks.length > 0 ? new Set(frameworks) : null;

  for (const item of items) {
    for (const control of CONTROL_MAPPINGS) {
      if (frameworkFilter && !frameworkFilter.has(control.framework)) continue;

      const isGap = control.triggersWhen(item);
      mappings.push({
        assetId: item.assetId ?? item.id,
        framework: control.framework,
        controlId: control.controlId,
        controlTitle: control.controlTitle,
        applicability: control.applicability,
        gapStatus: isGap ? "gap" : "compliant",
        evidence: isGap ? control.gapMessage : undefined,
      });
    }
  }

  return mappings;
}
