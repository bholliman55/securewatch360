/**
 * Deterministic posture scoring engine for SecureWatch360.
 *
 * Produces an overall posture score, per-category scores, framework readiness,
 * gap analysis, and prioritized roadmap item generation — no LLM calls.
 */
import { ROADMAP_CATEGORY_LABELS } from "@/types/posture-roadmap";
import type { RoadmapCategory } from "@/types/posture-roadmap";

// ─────────────────────────────────────────────────────────────────────────────
// Public input / output types
// ─────────────────────────────────────────────────────────────────────────────

export interface PostureScoringInput {
  tenantId: string;
  openFindings: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    category: string | null;
    assetType: string;
    exposure: string;
    status: string;
    priorityScore: number;
  }>;
  totalAssets: number;
  internetExposedAssets: number;
  endpointsCoveredByEdr: number;
  endpointsWithDiskEncryption: number;
  totalUsers: number;
  usersWithMfaEnabled: number;
  privilegedUsersWithMfa: number;
  totalPrivilegedUsers: number;
  ssoEnabled: boolean;
  assetsWithRecentScan: number;
  criticalVulnsOpenOver7Days: number;
  highVulnsOpenOver30Days: number;
  backupConfigured: boolean;
  backupTestedRecently: boolean;
  offsiteBackupEnabled: boolean;
  immutableBackupEnabled: boolean;
  centralizedLoggingEnabled: boolean;
  auditLoggingEnabled: boolean;
  siemConnected: boolean;
  controlsMapped: number;
  totalControls: number;
  evidenceArtifactsUploaded: number;
  sspDocumented: boolean;
  trainingCompletionPercent: number;
  phishingSimulationActive: boolean;
  lastTrainingDate: string | null;
  irpDocumented: boolean;
  irpTestedRecently: boolean;
  breachNotificationProcedure: boolean;
  isEstimated?: boolean;
}

export interface GeneratedGap {
  category: RoadmapCategory;
  categoryLabel: string;
  framework: string;
  controlId: string | null;
  controlName: string | null;
  currentState: string;
  desiredState: string;
  gapDescription: string;
  severity: "critical" | "high" | "medium" | "low";
  isEstimated: boolean;
}

export interface GeneratedRoadmapItem {
  title: string;
  category: RoadmapCategory;
  relatedFramework: string;
  currentState: string;
  desiredState: string;
  priority: "critical" | "high" | "medium" | "low";
  estimatedEffort: "low" | "medium" | "high";
  estimatedImpactScore: number;
  recommendedAction: string;
  automationLevel: "now" | "later" | "not_yet";
  isEstimated: boolean;
}

export interface PostureScoringResult {
  overallScore: number;
  maturityLabel: string;
  categoryScores: Record<string, number>;
  isEstimated: boolean;
}

export interface FrameworkReadinessResult {
  framework: string;
  readinessPercent: number;
  currentScore: number;
  targetScore: number;
  status: "ready" | "approaching" | "gap";
  isEstimated: boolean;
}

export interface DistanceToTargetResult {
  currentScore: number;
  targetScore: number;
  distance: number;
  percentOfWayThere: number;
  status: "ready" | "approaching" | "gap";
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Returns `fallback` when denominator is 0; otherwise numerator / denominator. */
function safeDivide(numerator: number, denominator: number, fallback = 1): number {
  return denominator === 0 ? fallback : numerator / denominator;
}

function maturityLabel(score: number): string {
  if (score >= 85) return "Advanced";
  if (score >= 70) return "Managed";
  if (score >= 50) return "Developing";
  if (score >= 30) return "Initiating";
  return "Ad Hoc";
}

function findingsBySeverityAndKeywords(
  findings: PostureScoringInput["openFindings"],
  severities: Array<"critical" | "high" | "medium" | "low" | "info">,
  keywords: string[]
): PostureScoringInput["openFindings"] {
  return findings.filter(
    (f) =>
      severities.includes(f.severity) &&
      keywords.some((kw) => (f.category ?? "").toLowerCase().includes(kw))
  );
}

function isWithinMonths(dateStr: string | null, months: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return d >= cutoff;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category scoring functions — each returns 0–100
// ─────────────────────────────────────────────────────────────────────────────

function scoreIdentityAccess(input: PostureScoringInput): number {
  const mfaAll = safeDivide(input.usersWithMfaEnabled, input.totalUsers) * 40;
  const mfaPriv = safeDivide(input.privilegedUsersWithMfa, input.totalPrivilegedUsers) * 35;
  const sso = input.ssoEnabled ? 15 : 0;

  const authKeywords = ["auth", "identity", "access", "credential"];
  const critCount = findingsBySeverityAndKeywords(input.openFindings, ["critical"], authKeywords).length;
  const highCount = findingsBySeverityAndKeywords(input.openFindings, ["high"], authKeywords).length;
  const deduction = clamp(critCount * 5 + highCount * 3, 0, 20);

  return clamp(mfaAll + mfaPriv + sso - deduction);
}

function scoreEndpointSecurity(input: PostureScoringInput): number {
  const edr = safeDivide(input.endpointsCoveredByEdr, input.totalAssets) * 50;
  const encryption = safeDivide(input.endpointsWithDiskEncryption, input.totalAssets) * 30;

  const endpointKeywords = ["endpoint", "workstation", "device", "malware", "antivirus", "edr"];
  const critCount = findingsBySeverityAndKeywords(input.openFindings, ["critical"], endpointKeywords).length;
  const highCount = findingsBySeverityAndKeywords(input.openFindings, ["high"], endpointKeywords).length;
  const deduction = clamp(critCount * 5 + highCount * 2, 0, 30);

  return clamp(edr + encryption - deduction);
}

function scoreVulnerabilityManagement(input: PostureScoringInput): number {
  const scanCoverage = safeDivide(input.assetsWithRecentScan, input.totalAssets) * 40;

  const slaBase = 60;
  const critDeduction = Math.min(input.criticalVulnsOpenOver7Days * 20, 60);
  const highDeduction = Math.min(input.highVulnsOpenOver30Days * 5, 30);
  const slaScore = clamp(slaBase - critDeduction - highDeduction);

  return clamp(scanCoverage + slaScore);
}

function scoreNetworkSecurity(input: PostureScoringInput): number {
  let score = 70;

  const exposureRatio = safeDivide(input.internetExposedAssets, input.totalAssets, 0);
  if (exposureRatio > 0.3) {
    score -= (exposureRatio - 0.3) * 100;
  }

  const networkKeywords = ["network", "port", "exposure", "firewall"];
  const critCount = findingsBySeverityAndKeywords(input.openFindings, ["critical"], networkKeywords).length;
  const highCount = findingsBySeverityAndKeywords(input.openFindings, ["high"], networkKeywords).length;
  const deduction = clamp(critCount * 5 + highCount * 2, 0, 30);

  return clamp(score - deduction);
}

function scoreBackupRecovery(input: PostureScoringInput): number {
  let score = 0;
  if (input.backupConfigured) score += 30;
  if (input.backupTestedRecently) score += 25;
  if (input.offsiteBackupEnabled) score += 25;
  if (input.immutableBackupEnabled) score += 20;
  return clamp(score);
}

function scoreMonitoringLogging(input: PostureScoringInput): number {
  let score = 0;
  if (input.centralizedLoggingEnabled) score += 35;
  if (input.auditLoggingEnabled) score += 30;
  if (input.siemConnected) score += 35;
  return clamp(score);
}

function scoreComplianceEvidence(input: PostureScoringInput): number {
  const controlCoverage = safeDivide(input.controlsMapped, Math.max(input.totalControls, 1)) * 60;
  const evidenceCoverage =
    Math.min(safeDivide(input.evidenceArtifactsUploaded, Math.max(input.controlsMapped, 1)), 1) * 25;
  const ssp = input.sspDocumented ? 15 : 0;
  return clamp(controlCoverage + evidenceCoverage + ssp);
}

function scoreSecurityAwareness(input: PostureScoringInput): number {
  const training = (input.trainingCompletionPercent / 100) * 60;
  const phishing = input.phishingSimulationActive ? 25 : 0;
  const recentTraining = isWithinMonths(input.lastTrainingDate, 12) ? 15 : 0;
  return clamp(training + phishing + recentTraining);
}

function scoreIncidentResponse(input: PostureScoringInput): number {
  let score = 0;
  if (input.irpDocumented) score += 40;
  if (input.irpTestedRecently) score += 35;
  if (input.breachNotificationProcedure) score += 25;
  return clamp(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Weights
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<RoadmapCategory, number> = {
  identity_access: 0.2,
  endpoint_security: 0.15,
  vulnerability_management: 0.15,
  network_security: 0.1,
  backup_recovery: 0.1,
  monitoring_logging: 0.1,
  compliance_evidence: 0.1,
  security_awareness: 0.05,
  incident_response: 0.05,
};

type FrameworkWeights = Partial<Record<RoadmapCategory, number>>;

const FRAMEWORK_WEIGHTS: Record<string, FrameworkWeights> = {
  CIS: {
    identity_access: 0.2,
    endpoint_security: 0.25,
    vulnerability_management: 0.25,
    network_security: 0.15,
    monitoring_logging: 0.15,
  },
  NIST: {
    identity_access: 0.15,
    endpoint_security: 0.15,
    vulnerability_management: 0.2,
    network_security: 0.15,
    monitoring_logging: 0.2,
    compliance_evidence: 0.15,
  },
  CMMC_L1: {
    identity_access: 0.3,
    endpoint_security: 0.25,
    vulnerability_management: 0.25,
    network_security: 0.2,
  },
  CMMC_L2: {
    identity_access: 0.2,
    endpoint_security: 0.15,
    vulnerability_management: 0.15,
    network_security: 0.1,
    backup_recovery: 0.1,
    monitoring_logging: 0.1,
    compliance_evidence: 0.1,
    security_awareness: 0.05,
    incident_response: 0.05,
  },
  HIPAA: {
    identity_access: 0.2,
    endpoint_security: 0.1,
    backup_recovery: 0.2,
    monitoring_logging: 0.15,
    compliance_evidence: 0.2,
    security_awareness: 0.1,
    incident_response: 0.05,
  },
  SOC2: {
    identity_access: 0.2,
    endpoint_security: 0.1,
    vulnerability_management: 0.15,
    network_security: 0.1,
    monitoring_logging: 0.2,
    compliance_evidence: 0.25,
  },
};

const FRAMEWORK_TARGET_SCORES: Record<string, number> = {
  CIS: 70,
  NIST: 65,
  CMMC_L1: 60,
  CMMC_L2: 80,
  HIPAA: 75,
  SOC2: 72,
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal category score computation
// ─────────────────────────────────────────────────────────────────────────────

function computeAllCategoryScores(input: PostureScoringInput): Record<RoadmapCategory, number> {
  return {
    identity_access: scoreIdentityAccess(input),
    endpoint_security: scoreEndpointSecurity(input),
    vulnerability_management: scoreVulnerabilityManagement(input),
    network_security: scoreNetworkSecurity(input),
    backup_recovery: scoreBackupRecovery(input),
    monitoring_logging: scoreMonitoringLogging(input),
    compliance_evidence: scoreComplianceEvidence(input),
    security_awareness: scoreSecurityAwareness(input),
    incident_response: scoreIncidentResponse(input),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Calculates the overall weighted posture score and per-category breakdown. */
export function calculateOverallPostureScore(input: PostureScoringInput): PostureScoringResult {
  const categoryScores = computeAllCategoryScores(input);

  let overallScore = 0;
  for (const cat of Object.keys(CATEGORY_WEIGHTS) as RoadmapCategory[]) {
    overallScore += (categoryScores[cat] ?? 0) * CATEGORY_WEIGHTS[cat];
  }

  return {
    overallScore: clamp(Math.round(overallScore)),
    maturityLabel: maturityLabel(overallScore),
    categoryScores,
    isEstimated: input.isEstimated ?? false,
  };
}

/** Calculates how ready the tenant is for a specific compliance framework. */
export function calculateFrameworkReadiness(
  input: PostureScoringInput,
  framework: string
): FrameworkReadinessResult {
  const categoryScores = computeAllCategoryScores(input);
  const weights = FRAMEWORK_WEIGHTS[framework] ?? {};
  const targetScore = FRAMEWORK_TARGET_SCORES[framework] ?? 70;

  let readinessPercent = 0;
  for (const [cat, weight] of Object.entries(weights) as [RoadmapCategory, number][]) {
    readinessPercent += (categoryScores[cat] ?? 0) * weight;
  }
  readinessPercent = clamp(Math.round(readinessPercent));

  const { overallScore } = calculateOverallPostureScore(input);

  let status: "ready" | "approaching" | "gap";
  if (readinessPercent >= targetScore) {
    status = "ready";
  } else if (readinessPercent >= targetScore - 15) {
    status = "approaching";
  } else {
    status = "gap";
  }

  return {
    framework,
    readinessPercent,
    currentScore: overallScore,
    targetScore,
    status,
    isEstimated: input.isEstimated ?? false,
  };
}

/** Generates a list of security gaps for the tenant against a target framework. */
export function generatePostureGaps(
  input: PostureScoringInput,
  targetFramework: string
): GeneratedGap[] {
  const gaps: GeneratedGap[] = [];
  const isEstimated = input.isEstimated ?? false;
  const fw = targetFramework;

  const makeGap = (
    category: RoadmapCategory,
    severity: GeneratedGap["severity"],
    currentState: string,
    desiredState: string,
    gapDescription: string,
    controlId: string | null = null,
    controlName: string | null = null
  ): GeneratedGap => ({
    category,
    categoryLabel: ROADMAP_CATEGORY_LABELS[category],
    framework: fw,
    controlId,
    controlName,
    currentState,
    desiredState,
    gapDescription,
    severity,
    isEstimated,
  });

  // ── Identity & Access ─────────────────────────────────────────────────────

  if (input.totalPrivilegedUsers > 0) {
    const ratio = input.privilegedUsersWithMfa / input.totalPrivilegedUsers;
    if (ratio < 1.0) {
      const pct = Math.round(ratio * 100);
      gaps.push(
        makeGap(
          "identity_access",
          "critical",
          `${pct}% of privileged users have MFA enabled`,
          "100% of privileged users must have MFA enforced",
          "Privileged accounts without MFA present critical risk of credential-based attacks and unauthorized privileged access."
        )
      );
    }
  }

  if (input.totalUsers > 0) {
    const ratio = input.usersWithMfaEnabled / input.totalUsers;
    if (ratio < 0.9) {
      const pct = Math.round(ratio * 100);
      gaps.push(
        makeGap(
          "identity_access",
          "high",
          `${pct}% of all users have MFA enabled`,
          "≥90% of all users must have MFA enforced",
          "Insufficient MFA coverage across the user base increases risk of account compromise via phishing or credential stuffing."
        )
      );
    }
  }

  if (!input.ssoEnabled) {
    gaps.push(
      makeGap(
        "identity_access",
        "medium",
        "SSO is not configured",
        "SSO enabled for centralized authentication and access control",
        "Without SSO, credential sprawl increases risk and complicates timely access revocation."
      )
    );
  }

  // ── Endpoint Security ─────────────────────────────────────────────────────

  if (input.totalAssets > 0) {
    const edrRatio = input.endpointsCoveredByEdr / input.totalAssets;
    if (edrRatio < 0.9) {
      const severity: GeneratedGap["severity"] =
        edrRatio < 0.5 ? "critical" : edrRatio < 0.75 ? "high" : "medium";
      const pct = Math.round(edrRatio * 100);
      gaps.push(
        makeGap(
          "endpoint_security",
          severity,
          `${pct}% of endpoints are covered by EDR`,
          "≥90% EDR coverage across all managed endpoints",
          "Gaps in EDR coverage leave endpoints vulnerable to malware, ransomware, and lateral movement."
        )
      );
    }

    const encRatio = input.endpointsWithDiskEncryption / input.totalAssets;
    if (encRatio < 0.9) {
      const pct = Math.round(encRatio * 100);
      gaps.push(
        makeGap(
          "endpoint_security",
          "high",
          `${pct}% of endpoints have disk encryption enabled`,
          "≥90% of endpoints must have full disk encryption",
          "Unencrypted endpoints expose sensitive data if devices are lost, stolen, or compromised."
        )
      );
    }
  }

  // ── Vulnerability Management ──────────────────────────────────────────────

  if (input.criticalVulnsOpenOver7Days > 0) {
    gaps.push(
      makeGap(
        "vulnerability_management",
        "critical",
        `${input.criticalVulnsOpenOver7Days} critical vulnerabilities open beyond the 7-day SLA`,
        "All critical vulnerabilities remediated within 7 days of discovery",
        "Critical vulnerabilities open beyond SLA represent an active exploitation window for threat actors."
      )
    );
  }

  if (input.highVulnsOpenOver30Days > 0) {
    gaps.push(
      makeGap(
        "vulnerability_management",
        "high",
        `${input.highVulnsOpenOver30Days} high-severity vulnerabilities open beyond the 30-day SLA`,
        "All high-severity vulnerabilities remediated within 30 days of discovery",
        "High-severity vulnerabilities past SLA materially widen the window of exposure to targeted attacks."
      )
    );
  }

  // ── Backup & Recovery ─────────────────────────────────────────────────────

  if (!input.backupConfigured) {
    gaps.push(
      makeGap(
        "backup_recovery",
        "critical",
        "No backup solution is configured",
        "Automated, tested backup solution covering all critical systems",
        "Without backups, ransomware or accidental deletion incidents may be completely unrecoverable."
      )
    );
  }

  if (!input.offsiteBackupEnabled || !input.immutableBackupEnabled) {
    const missing: string[] = [];
    if (!input.offsiteBackupEnabled) missing.push("offsite storage");
    if (!input.immutableBackupEnabled) missing.push("immutable backup");
    gaps.push(
      makeGap(
        "backup_recovery",
        "high",
        `Backup configuration is missing: ${missing.join(", ")}`,
        "Offsite and immutable backups configured for ransomware resilience",
        "Backups without offsite replication or write-once immutability can be destroyed in ransomware attacks."
      )
    );
  }

  if (!input.backupTestedRecently) {
    gaps.push(
      makeGap(
        "backup_recovery",
        "medium",
        "Backup restoration has not been tested within the last 90 days",
        "Backup restoration tested and verified at least every 90 days",
        "Untested backups frequently fail during actual recovery scenarios, negating the backup investment."
      )
    );
  }

  // ── Monitoring & Logging ──────────────────────────────────────────────────

  if (!input.centralizedLoggingEnabled) {
    const severity: GeneratedGap["severity"] =
      fw === "CMMC_L2" || fw === "SOC2" ? "high" : "medium";
    gaps.push(
      makeGap(
        "monitoring_logging",
        severity,
        "Centralized logging is not enabled",
        "Centralized logging aggregating all system and security events",
        "Without centralized logging, incident detection and forensic investigation are severely limited."
      )
    );
  }

  // ── Compliance Evidence ───────────────────────────────────────────────────

  if (input.totalControls > 0) {
    const controlRatio = input.controlsMapped / input.totalControls;
    if (controlRatio < 0.7) {
      const severity: GeneratedGap["severity"] = fw === "CMMC_L2" ? "high" : "medium";
      const pct = Math.round(controlRatio * 100);
      gaps.push(
        makeGap(
          "compliance_evidence",
          severity,
          `${pct}% of required controls are mapped with evidence`,
          "≥70% of required controls mapped and evidenced",
          "Low control mapping coverage will result in compliance audit failures and undetected risk."
        )
      );
    }
  }

  // ── Security Awareness ────────────────────────────────────────────────────

  if (input.trainingCompletionPercent < 80) {
    gaps.push(
      makeGap(
        "security_awareness",
        "medium",
        `${Math.round(input.trainingCompletionPercent)}% security awareness training completion`,
        "≥80% security awareness training completion across all users",
        "Low training completion leaves the workforce susceptible to phishing and social engineering attacks."
      )
    );
  }

  if (!input.phishingSimulationActive) {
    gaps.push(
      makeGap(
        "security_awareness",
        "medium",
        "No active phishing simulation program",
        "Regular phishing simulations measuring and improving user resilience",
        "Without phishing simulations users remain undertrained for real-world social engineering threats."
      )
    );
  }

  // ── Incident Response ─────────────────────────────────────────────────────

  if (!input.irpDocumented) {
    gaps.push(
      makeGap(
        "incident_response",
        "high",
        "Incident Response Plan is not documented",
        "Documented IRP covering detection, containment, eradication, recovery, and stakeholder communication",
        "An undocumented incident response process leads to chaotic and costly breach responses."
      )
    );
  }

  // ── Internet-exposed critical vuln compound gap ───────────────────────────

  if (input.internetExposedAssets > 0 && input.criticalVulnsOpenOver7Days > 0) {
    gaps.push(
      makeGap(
        "network_security",
        "critical",
        `${input.internetExposedAssets} internet-exposed assets with ${input.criticalVulnsOpenOver7Days} critical vulnerabilities unpatched`,
        "No unpatched critical vulnerabilities present on internet-exposed assets",
        "Internet-exposed assets with unpatched critical vulnerabilities represent an immediate active exploitation target for external threat actors."
      )
    );
  }

  return gaps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Roadmap item generation
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

/** Maps a generated gap to its corresponding prioritized roadmap item. */
function gapToRoadmapItem(gap: GeneratedGap): GeneratedRoadmapItem {
  const category = gap.category;
  const priority = gap.severity;

  let title: string;
  let recommendedAction: string;
  let estimatedEffort: "low" | "medium" | "high";
  let estimatedImpactScore: number;
  let automationLevel: "now" | "later" | "not_yet";

  switch (category) {
    case "identity_access": {
      if (gap.currentState.toLowerCase().includes("privileged")) {
        title = "Enforce MFA for All Privileged Users";
        recommendedAction =
          "Enable MFA enforcement policy for all privileged accounts in your IdP/directory service.";
        estimatedEffort = "low";
        estimatedImpactScore = 95;
        automationLevel = "now";
      } else if (gap.currentState.toUpperCase().includes("MFA")) {
        title = "Expand MFA Coverage to All Users";
        recommendedAction =
          "Roll out MFA to remaining users via conditional access policies in your identity platform.";
        estimatedEffort = "medium";
        estimatedImpactScore = 88;
        automationLevel = "now";
      } else {
        title = "Enable SSO for Centralized Authentication";
        recommendedAction =
          "Configure SSO via SAML 2.0 or OIDC with your identity provider to centralize authentication and access control.";
        estimatedEffort = "high";
        estimatedImpactScore = 80;
        automationLevel = "later";
      }
      break;
    }
    case "endpoint_security": {
      if (gap.currentState.toUpperCase().includes("EDR")) {
        title = "Expand EDR Coverage to All Endpoints";
        recommendedAction =
          "Deploy EDR agent to unmanaged endpoints and enforce enrollment through MDM policy.";
        estimatedEffort = "medium";
        estimatedImpactScore = 85;
        automationLevel = "now";
      } else {
        title = "Enable Full Disk Encryption on All Endpoints";
        recommendedAction =
          "Deploy disk encryption (BitLocker / FileVault) to all endpoints via MDM policy.";
        estimatedEffort = "medium";
        estimatedImpactScore = 80;
        automationLevel = "now";
      }
      break;
    }
    case "vulnerability_management": {
      if (priority === "critical") {
        title = "Remediate Critical Vulnerabilities Within SLA";
        recommendedAction =
          "Prioritize and patch all critical CVEs within the 7-day SLA. Enable automated patching where safe.";
        estimatedEffort = "high";
        estimatedImpactScore = 90;
        automationLevel = "now";
      } else {
        title = "Remediate High Vulnerabilities Within SLA";
        recommendedAction =
          "Schedule patching cycles to address all high-severity vulnerabilities within the 30-day SLA.";
        estimatedEffort = "medium";
        estimatedImpactScore = 78;
        automationLevel = "now";
      }
      break;
    }
    case "network_security": {
      title = "Remediate Internet-Exposed Critical Vulnerabilities";
      recommendedAction =
        "Immediately patch or network-isolate internet-exposed assets carrying critical vulnerabilities.";
      estimatedEffort = "high";
      estimatedImpactScore = 92;
      automationLevel = "now";
      break;
    }
    case "backup_recovery": {
      if (priority === "critical") {
        title = "Implement a Backup Solution for Critical Systems";
        recommendedAction =
          "Deploy an automated backup solution covering all critical systems and data stores.";
        estimatedEffort = "high";
        estimatedImpactScore = 82;
        automationLevel = "not_yet";
      } else if (priority === "high") {
        title = "Configure Offsite and Immutable Backups";
        recommendedAction =
          "Enable offsite replication and immutable (WORM) storage to protect backups against ransomware.";
        estimatedEffort = "medium";
        estimatedImpactScore = 78;
        automationLevel = "not_yet";
      } else {
        title = "Schedule and Document Backup Restoration Tests";
        recommendedAction =
          "Conduct a backup restoration test, document results, and schedule recurring quarterly tests.";
        estimatedEffort = "low";
        estimatedImpactScore = 65;
        automationLevel = "not_yet";
      }
      break;
    }
    case "monitoring_logging": {
      if (gap.currentState.toLowerCase().includes("centralized")) {
        title = "Enable Centralized Security Logging";
        recommendedAction =
          "Deploy a centralized log management platform collecting security events from all systems.";
        estimatedEffort = "high";
        estimatedImpactScore = 75;
        automationLevel = "now";
      } else {
        title = "Connect SIEM for Security Event Correlation";
        recommendedAction =
          "Integrate log sources with a SIEM platform for real-time threat detection and correlation.";
        estimatedEffort = "high";
        estimatedImpactScore = 72;
        automationLevel = "later";
      }
      break;
    }
    case "compliance_evidence": {
      title = "Build Control Mapping and Evidence Library";
      recommendedAction =
        "Map remaining security controls to compliance requirements and upload supporting evidence artifacts.";
      estimatedEffort = "high";
      estimatedImpactScore = 68;
      automationLevel = "later";
      break;
    }
    case "security_awareness": {
      if (gap.currentState.toLowerCase().includes("training")) {
        title = "Increase Security Awareness Training Completion";
        recommendedAction =
          "Launch a mandatory training campaign with manager escalation for users who have not completed assignments.";
        estimatedEffort = "medium";
        estimatedImpactScore = 58;
        automationLevel = "not_yet";
      } else {
        title = "Launch a Phishing Simulation Program";
        recommendedAction =
          "Deploy a phishing simulation platform and run quarterly simulations with targeted follow-up training.";
        estimatedEffort = "medium";
        estimatedImpactScore = 55;
        automationLevel = "not_yet";
      }
      break;
    }
    case "incident_response": {
      title = "Document the Incident Response Plan";
      recommendedAction =
        "Develop and publish an IRP covering detection, containment, eradication, recovery, and breach notification.";
      estimatedEffort = "medium";
      estimatedImpactScore = 70;
      automationLevel = "not_yet";
      break;
    }
    default: {
      title = `Remediate ${ROADMAP_CATEGORY_LABELS[category as RoadmapCategory] ?? category} Gap`;
      recommendedAction = gap.gapDescription;
      estimatedEffort = "medium";
      estimatedImpactScore = 60;
      automationLevel = "not_yet";
    }
  }

  return {
    title,
    category,
    relatedFramework: gap.framework,
    currentState: gap.currentState,
    desiredState: gap.desiredState,
    priority,
    estimatedEffort,
    estimatedImpactScore,
    recommendedAction,
    automationLevel,
    isEstimated: gap.isEstimated,
  };
}

/** Maps generated gaps to prioritized roadmap items sorted by priority then impact. */
export function generateRoadmapItems(gaps: GeneratedGap[]): GeneratedRoadmapItem[] {
  return gaps
    .map(gapToRoadmapItem)
    .sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.priority);
      const pb = PRIORITY_ORDER.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return b.estimatedImpactScore - a.estimatedImpactScore;
    });
}

/** Returns distance metrics between current posture and a target score. */
export function calculateDistanceToTarget(
  currentScore: number,
  targetScore: number
): DistanceToTargetResult {
  const distance = Math.max(0, targetScore - currentScore);
  const percentOfWayThere = clamp(Math.round((currentScore / Math.max(targetScore, 1)) * 100));

  let status: "ready" | "approaching" | "gap";
  if (currentScore >= targetScore) {
    status = "ready";
  } else if (currentScore >= targetScore - 15) {
    status = "approaching";
  } else {
    status = "gap";
  }

  return { currentScore, targetScore, distance, percentOfWayThere, status };
}
