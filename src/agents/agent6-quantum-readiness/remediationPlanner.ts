/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Generates prioritised remediation tasks from a Quantum Readiness Assessment
 * and the underlying crypto inventory. Tasks are assessment-level (patterns
 * across all items) plus per-item tasks for discrete, actionable issues.
 */

import type {
  CryptoInventoryItem,
  QuantumReadinessAssessment,
  QuantumRemediationTask,
  QuantumRiskLevel,
} from "./types";
import { normalizeAlgorithmName } from "./quantumRiskEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

type EffortLevel = "low" | "medium" | "high";

// Extend the public type locally with the effort shape this planner uses.
type PlannerTask = QuantumRemediationTask & { estimatedEffort: EffortLevel };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a deduplicated, priority-ordered list of remediation tasks.
 *
 * Tasks are derived from two sources:
 *   1. Assessment-level patterns — one task per observed category of risk
 *      (e.g. "Disable TLS 1.0/1.1 across all affected endpoints").
 *   2. Per-item tasks — discrete, host-specific actions for the most urgent
 *      findings (sub-2048 RSA, deprecated TLS versions, expiring PQC certs).
 */
export function generateQuantumRemediationTasks(
  clientId: string,
  assessment: QuantumReadinessAssessment,
  items: CryptoInventoryItem[],
): QuantumRemediationTask[] {
  const tasks: PlannerTask[] = [
    ...generateCriticalTasks(clientId, assessment, items),
    ...generateHighTasks(clientId, assessment, items),
    ...generateMediumTasks(clientId, assessment, items),
    ...generateLowTasks(clientId, assessment, items),
  ];

  return sortByPriority(deduplicate(tasks));
}

// ── Critical Tasks ────────────────────────────────────────────────────────────

function generateCriticalTasks(
  clientId: string,
  assessment: QuantumReadinessAssessment,
  items: CryptoInventoryItem[],
): PlannerTask[] {
  const tasks: PlannerTask[] = [];

  // Sub-2048 RSA — one aggregated task + per-host tasks
  const weakRsaItems = items.filter(
    (i) =>
      i.isQuantumVulnerable &&
      normalizeAlgorithmName(i.algorithm).toUpperCase().includes("RSA") &&
      i.keyLength !== undefined &&
      i.keyLength < 2048,
  );
  if (weakRsaItems.length > 0) {
    tasks.push({
      clientId,
      title: "Replace all RSA keys below 2048 bits",
      description:
        `${weakRsaItems.length} asset${weakRsaItems.length > 1 ? "s" : ""} use RSA keys shorter than ` +
        `2048 bits, which are vulnerable to both classical and near-term quantum attacks. ` +
        `These must be replaced immediately — they are below NIST's minimum key size floor ` +
        `and ineligible for any migration grace period.`,
      priority: "critical",
      recommendedAction:
        "Immediately revoke and reissue all sub-2048 RSA keys. Replace with ML-KEM-768 (FIPS 203) " +
        "for key encapsulation or ML-DSA-65 (FIPS 204) for digital signatures.",
      targetStandard: "ML-KEM-768 / ML-DSA-65",
      estimatedEffort: "medium",
      status: "open",
    });

    // Per-host tasks for each weak RSA asset
    for (const item of weakRsaItems) {
      const label = item.assetHostname ?? item.serviceName ?? item.assetIp ?? "unknown host";
      tasks.push({
        clientId,
        inventoryId: item.id,
        title: `Replace RSA-${item.keyLength ?? "<unknown>"} key on ${label}`,
        description:
          `${label} has an RSA key of ${item.keyLength ?? "unknown"} bits — below the 2048-bit minimum. ` +
          `Replace with a NIST PQC algorithm (ML-DSA-65 for signing, ML-KEM-768 for encryption).`,
        priority: "critical",
        recommendedAction: `Revoke and reissue key on ${label} using ML-DSA-65 or ML-KEM-768`,
        targetStandard: "ML-DSA-65",
        estimatedEffort: "low",
        status: "open",
      });
    }
  }

  // Deprecated TLS versions
  const deprecatedTlsItems = items.filter(
    (i) => i.tlsVersion === "TLSv1.0" || i.tlsVersion === "TLSv1.1",
  );
  if (deprecatedTlsItems.length > 0) {
    const versions = [...new Set(deprecatedTlsItems.map((i) => i.tlsVersion).filter(Boolean))].join(" and ");
    tasks.push({
      clientId,
      title: `Disable ${versions} on all affected endpoints`,
      description:
        `${deprecatedTlsItems.length} endpoint${deprecatedTlsItems.length > 1 ? "s" : ""} still accept ` +
        `${versions}, which are prohibited by NIST SP 800-52 Rev. 2 and IETF RFC 8996. ` +
        `These versions use broken cipher suites and provide no quantum-safe forward secrecy. ` +
        `Enforce TLS 1.3 as the preferred version with TLS 1.2 as the absolute minimum.`,
      priority: "critical",
      recommendedAction:
        "Disable TLS 1.0 and TLS 1.1 in all server and load balancer configurations. " +
        "Enforce TLS 1.3 (preferred) with TLS 1.2 as minimum. Enable HSTS.",
      targetStandard: "TLS 1.3",
      estimatedEffort: "low",
      status: "open",
    });

    for (const item of deprecatedTlsItems) {
      const label = item.assetHostname ?? item.assetIp ?? "unknown host";
      tasks.push({
        clientId,
        inventoryId: item.id,
        title: `Disable ${item.tlsVersion} on ${label}${item.port ? `:${item.port}` : ""}`,
        description:
          `${label} is accepting connections over ${item.tlsVersion}. ` +
          `Update the server/load balancer configuration to reject this protocol version.`,
        priority: "critical",
        recommendedAction: `Set minimum TLS version to 1.2 (TLS 1.3 preferred) on ${label}`,
        targetStandard: "TLS 1.3",
        estimatedEffort: "low",
        status: "open",
      });
    }
  }

  // Public-facing systems (VPN, API gateway, identity provider) using RSA/ECC
  const publicCriticalItems = items.filter(
    (i) =>
      i.isQuantumVulnerable &&
      isPublicFacingCriticalSystem(i) &&
      i.quantumRiskLevel !== "low",
  );
  if (publicCriticalItems.length > 0) {
    const systemTypes = [...new Set(publicCriticalItems.map((i) => i.assetType ?? i.cryptoUsage))].join(", ");
    tasks.push({
      clientId,
      title: "Prioritise PQC migration for public-facing VPN, API, and identity systems",
      description:
        `${publicCriticalItems.length} public-facing system${publicCriticalItems.length > 1 ? "s" : ""} ` +
        `(${systemTypes}) use quantum-vulnerable algorithms for authentication or key exchange. ` +
        `These are the highest-priority targets for harvest-now-decrypt-later attacks — ` +
        `adversaries are likely collecting encrypted traffic today for future quantum decryption. ` +
        `These systems must be migrated to post-quantum cryptography before less-exposed assets.`,
      priority: "critical",
      recommendedAction:
        "Fast-track PQC migration for VPN gateways, API gateways, and identity providers. " +
        "Deploy hybrid post-quantum TLS (X25519MLKEM768) and plan certificate migration to ML-DSA.",
      targetStandard: "Hybrid PQC (X25519MLKEM768 + ML-DSA-65)",
      estimatedEffort: "high",
      status: "open",
    });
  }

  // Harvest-now-decrypt-later — one-time cross-asset task
  if (assessment.harvestNowDecryptLaterExposure) {
    tasks.push({
      clientId,
      title: "Mitigate harvest-now-decrypt-later exposure",
      description:
        "One or more assets transmit or store data protected by quantum-vulnerable cryptography " +
        "in contexts where long-term confidentiality is required (TLS, VPN, database encryption, " +
        "API authentication). Sophisticated adversaries may be capturing ciphertext now for decryption " +
        "once a cryptographically-relevant quantum computer (CRQC) becomes available (estimated 5–15 years). " +
        "Data with a confidentiality requirement exceeding that window is at immediate risk.",
      priority: "critical",
      recommendedAction:
        "Identify all data assets requiring >10-year confidentiality. Accelerate PQC migration " +
        "for those assets above all others. Consider hybrid encryption (classical + ML-KEM-768) " +
        "as an interim measure deployable ahead of full PQC rollout.",
      targetStandard: "ML-KEM-768 (FIPS 203) / Hybrid PQC",
      estimatedEffort: "high",
      status: "open",
    });
  }

  return tasks;
}

// ── High Tasks ────────────────────────────────────────────────────────────────

function generateHighTasks(
  clientId: string,
  assessment: QuantumReadinessAssessment,
  items: CryptoInventoryItem[],
): PlannerTask[] {
  const tasks: PlannerTask[] = [];

  // TLS certificates using RSA/ECC — inventory and track
  const tlsCertItems = items.filter(
    (i) =>
      i.isQuantumVulnerable &&
      (i.cryptoUsage === "tls" || i.cryptoUsage === "certificate") &&
      i.certificateSubject !== undefined,
  );
  if (tlsCertItems.length > 0) {
    tasks.push({
      clientId,
      title: "Inventory all TLS certificates using RSA or ECC and establish migration baseline",
      description:
        `${tlsCertItems.length} TLS certificate${tlsCertItems.length > 1 ? "s" : ""} using quantum-vulnerable ` +
        `algorithms (RSA/ECC) have been discovered. A complete, authoritative inventory is the prerequisite ` +
        `for any organised PQC migration programme. Without it, migrations will be incomplete and shadow ` +
        `certificates will be missed. Include certificates from all CAs, load balancers, CDNs, and internal PKI.`,
      priority: "high",
      recommendedAction:
        "Export full certificate inventory from all certificate authorities, load balancers, and secret stores. " +
        "Record algorithm, key length, expiry date, and responsible team per certificate. " +
        "Prioritise renewal with ML-DSA-65 (FIPS 204) or a hybrid scheme.",
      targetStandard: "ML-DSA-65 (FIPS 204)",
      estimatedEffort: "medium",
      status: "open",
    });
  }

  // Vendor PQC readiness — triggered if any high/critical findings
  if (assessment.highRiskAssets > 0 || assessment.vulnerableCryptoAssets > 0) {
    tasks.push({
      clientId,
      title: "Confirm post-quantum cryptography roadmap with all critical vendors",
      description:
        "Third-party vendors providing TLS endpoints, VPN solutions, identity platforms, and PKI services " +
        "must have a documented PQC migration roadmap before your own migration can complete. " +
        "Vendor readiness is a common bottleneck — many enterprise products will not support NIST PQC " +
        "standards (FIPS 203/204/205) until 2026–2028. Establishing vendor status now avoids " +
        "last-minute blockers when internal systems are ready to migrate.",
      priority: "high",
      recommendedAction:
        "Contact all vendors supplying cryptographic capabilities and request: (1) current PQC algorithm support, " +
        "(2) confirmed roadmap date for FIPS 203/204/205 support, (3) interim hybrid options. " +
        "Escalate if vendor cannot confirm a roadmap within 60 days.",
      targetStandard: "NIST FIPS 203 / FIPS 204 / FIPS 205",
      estimatedEffort: "medium",
      status: "open",
    });
  }

  // PQC migration planning for TLS, VPN, and identity systems
  const migrateableItems = items.filter(
    (i) =>
      i.isQuantumVulnerable &&
      ["tls", "vpn", "api_authentication"].includes(i.cryptoUsage) &&
      i.quantumRiskLevel !== "critical",
  );
  if (migrateableItems.length > 0) {
    tasks.push({
      clientId,
      title: "Create PQC migration plan for TLS, VPN, and identity systems",
      description:
        `${migrateableItems.length} TLS, VPN, and API authentication asset${migrateableItems.length > 1 ? "s" : ""} ` +
        `are quantum-vulnerable. A structured migration plan prevents piecemeal, uncoordinated changes and ensures ` +
        `interoperability is maintained during the transition. The plan should account for hybrid deployments ` +
        `(classical + PQC in parallel) which allow gradual rollout without breaking non-PQC-capable clients.`,
      priority: "high",
      recommendedAction:
        "Draft a phased PQC migration plan: (1) hybrid TLS with X25519MLKEM768 for key exchange, " +
        "(2) ML-DSA-65 certificates once CA support is available, " +
        "(3) full deprecation of classical algorithms on a defined date. " +
        "Use NIST IR 8413 and CISA PQC Migration Guide as reference frameworks.",
      targetStandard: "Hybrid PQC → ML-KEM-768 + ML-DSA-65",
      estimatedEffort: "high",
      status: "open",
    });
  }

  return tasks;
}

// ── Medium Tasks ──────────────────────────────────────────────────────────────

function generateMediumTasks(
  clientId: string,
  assessment: QuantumReadinessAssessment,
  items: CryptoInventoryItem[],
): PlannerTask[] {
  const tasks: PlannerTask[] = [];

  // Internal RSA/ECC usage tracking
  const internalItems = items.filter(
    (i) =>
      i.isQuantumVulnerable &&
      !isPublicFacingCriticalSystem(i) &&
      i.cryptoUsage !== "tls",
  );
  if (internalItems.length > 0) {
    tasks.push({
      clientId,
      title: "Track and document all internal RSA/ECC usage",
      description:
        `${internalItems.length} internal asset${internalItems.length > 1 ? "s" : ""} use quantum-vulnerable ` +
        `algorithms for SSH, code signing, database encryption, or email encryption. ` +
        `While less immediately exposed than internet-facing systems, these assets will require ` +
        `migration before CRQC availability and must be included in the organisation's PQC programme. ` +
        `An accurate internal inventory prevents gaps when the public-facing migration is complete.`,
      priority: "medium",
      recommendedAction:
        "Add all internal RSA/ECC assets to the crypto inventory. Assign each an owner, " +
        "document dependencies, and schedule migration within the 24-month PQC programme. " +
        "Prioritise assets that protect data with >10-year confidentiality requirements.",
      targetStandard: "ML-KEM-768 / ML-DSA-65 / SLH-DSA",
      estimatedEffort: "medium",
      status: "open",
    });
  }

  // Certificate lifecycle monitoring
  const certItems = items.filter((i) => i.certificateExpiration !== undefined);
  if (certItems.length > 0) {
    tasks.push({
      clientId,
      title: "Implement certificate lifecycle monitoring with PQC migration alerts",
      description:
        `${certItems.length} certificate${certItems.length > 1 ? "s" : ""} with expiry dates have been discovered. ` +
        `Certificate renewals are a natural, low-disruption opportunity to migrate from classical to PQC algorithms. ` +
        `Without automated lifecycle monitoring, these windows will be missed and certificates will be renewed ` +
        `with the same quantum-vulnerable algorithms. Configure alerts at 90, 60, and 30 days before expiry ` +
        `to ensure PQC-ready replacements are prepared in time.`,
      priority: "medium",
      recommendedAction:
        "Integrate certificate inventory with a monitoring system (e.g. Cert-Manager, Venafi, DigiCert CertCentral). " +
        "Add a PQC readiness flag to each certificate record. Configure renewal workflows to default to " +
        "ML-DSA-65 (or hybrid) once CA support is available.",
      targetStandard: "ML-DSA-65 (FIPS 204)",
      estimatedEffort: "medium",
      status: "open",
    });
  }

  // Crypto agility roadmap — always recommended if score < 85
  if (assessment.readinessScore < 85) {
    tasks.push({
      clientId,
      title: "Develop a cryptographic agility roadmap",
      description:
        "Cryptographic agility — the ability to swap algorithms without re-architecting systems — is the " +
        "foundation of a sustainable post-quantum migration. Organisations that hardcode specific algorithms " +
        "into application code or infrastructure will face significant rework costs for every future " +
        "algorithm transition. Establishing agility now reduces the cost and risk of the PQC migration " +
        "and any subsequent algorithm changes driven by cryptanalytic breakthroughs.",
      priority: "medium",
      recommendedAction:
        "Audit codebase and infrastructure for hardcoded algorithm identifiers. " +
        "Introduce algorithm abstraction layers (e.g. configurable TLS cipher suites, " +
        "pluggable KMS backends). Document a crypto standards board process for future algorithm decisions. " +
        "Reference NIST SP 800-175B Rev. 1 for cryptographic standards guidance.",
      targetStandard: "Crypto Agility Architecture",
      estimatedEffort: "high",
      status: "open",
    });
  }

  return tasks;
}

// ── Low Tasks ─────────────────────────────────────────────────────────────────

function generateLowTasks(
  clientId: string,
  assessment: QuantumReadinessAssessment,
  items: CryptoInventoryItem[],
): PlannerTask[] {
  const tasks: PlannerTask[] = [];

  // Validate any PQC/hybrid implementations already in place
  const pqcItems = items.filter((i) => !i.isQuantumVulnerable && i.quantumRiskLevel === "low");
  if (pqcItems.length > 0) {
    tasks.push({
      clientId,
      title: "Validate all PQC and hybrid cryptographic implementations",
      description:
        `${pqcItems.length} asset${pqcItems.length > 1 ? "s" : ""} appear to use quantum-resistant algorithms. ` +
        `These should be verified to confirm correct implementation — misconfigured hybrid schemes, ` +
        `downgrade attacks, or non-FIPS-validated libraries can undermine PQC protections even when the ` +
        `correct algorithm identifier is present. Validation should include library version checks, ` +
        `FIPS certificate verification, and interoperability testing.`,
      priority: "low",
      recommendedAction:
        "Verify that PQC implementations use FIPS 140-validated modules where required. " +
        "Confirm library versions are current (OpenSSL 3.x+, BoringSSL with PQC patches, etc.). " +
        "Test hybrid handshake fallback behaviour. Document FIPS certificate numbers for audit evidence.",
      targetStandard: "FIPS 140-3 validated PQC libraries",
      estimatedEffort: "low",
      status: "open",
    });
  }

  // Ongoing monitoring — always present
  tasks.push({
    clientId,
    title: "Maintain ongoing quantum readiness monitoring",
    description:
      "The quantum threat timeline is actively evolving. NIST continues to release additional PQC " +
      "standards and guidance, CAs are extending PQC certificate support, and enterprise software " +
      "vendors are shipping PQC-capable releases on varying schedules. " +
      `Current readiness score: ${assessment.readinessScore}/100. ` +
      "Regular reassessment ensures the organisation stays ahead of the migration curve and captures " +
      "new vulnerability disclosures (e.g. cryptanalytic attacks on specific PQC candidates).",
    priority: "low",
    recommendedAction:
      "Schedule quarterly quantum readiness scans. Subscribe to NIST PQC project updates " +
      "(csrc.nist.gov/projects/post-quantum-cryptography). Monitor CISA and NSA PQC advisories. " +
      "Rerun Agent 6 after each major infrastructure change.",
    targetStandard: "NIST PQC Standards (FIPS 203 / 204 / 205)",
    estimatedEffort: "low",
    status: "open",
  });

  return tasks;
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

function isPublicFacingCriticalSystem(item: CryptoInventoryItem): boolean {
  const publicAssetTypes = new Set([
    "public_web_app", "vpn_gateway", "api_gateway",
    "identity_provider", "email_gateway", "load_balancer",
  ]);
  const publicUsages = new Set(["tls", "vpn", "api_authentication"]);

  return (
    (item.assetType !== undefined && publicAssetTypes.has(item.assetType)) ||
    publicUsages.has(item.cryptoUsage)
  );
}

function deduplicate(tasks: PlannerTask[]): PlannerTask[] {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    // Key on client + normalised title (strip host-specific suffixes for assessment-level tasks)
    const key = `${task.clientId}::${task.title.toLowerCase().replace(/\s+on\s+.+$/, "").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const PRIORITY_ORDER: Record<QuantumRiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

function sortByPriority(tasks: PlannerTask[]): PlannerTask[] {
  return [...tasks].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4),
  );
}
