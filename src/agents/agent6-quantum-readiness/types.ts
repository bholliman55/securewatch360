/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Core type definitions for cryptographic asset discovery, risk scoring,
 * and post-quantum migration planning.
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

export type CryptoUsageType =
  | "tls"
  | "certificate"
  | "vpn"
  | "ssh"
  | "code_signing"
  | "email_encryption"
  | "database_encryption"
  | "api_authentication"
  | "unknown";

export type QuantumRiskLevel =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type QuantumVulnerabilityStatus =
  | "quantum_vulnerable"
  | "quantum_resistant"
  | "hybrid"
  | "unknown";

export type MigrationStatus =
  | "not_started"
  | "planned"
  | "in_progress"
  | "testing"
  | "completed"
  | "blocked";

export type AssetSensitivity = "public" | "internal" | "confidential" | "restricted";

export type AlgorithmFamily =
  | "asymmetric-classical"
  | "symmetric"
  | "hash"
  | "pqc-kem"
  | "pqc-signature"
  | "hybrid"
  | "unknown";

// Kept for backwards-compat with quantumRiskEngine; maps to QuantumRiskLevel
export type QuantumVulnerabilityLevel =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "none";

// ── Crypto Inventory Item ─────────────────────────────────────────────────────

/** Row in quantum_crypto_inventory — one discovered cryptographic asset. */
export interface CryptoInventoryItem {
  id?: string;
  clientId: string;
  assetId?: string;
  scanId?: string;
  assetHostname?: string;
  assetIp?: string;
  assetType?: string;
  serviceName?: string;
  port?: number;
  protocol?: string;
  cryptoUsage: CryptoUsageType;
  algorithm: string;
  keyLength?: number;
  certificateSubject?: string;
  certificateIssuer?: string;
  certificateExpiration?: string;     // ISO 8601
  tlsVersion?: string;
  isQuantumVulnerable: boolean;
  quantumRiskLevel: QuantumRiskLevel;
  vulnerabilityStatus: QuantumVulnerabilityStatus;
  discoverySource: string;
  evidence: Record<string, unknown>;
}

// ── Quantum Readiness Assessment ──────────────────────────────────────────────

/** Aggregate readiness score for a client / scan. */
export interface QuantumReadinessAssessment {
  clientId: string;
  scanId?: string;
  readinessScore: number;             // 0–100; 100 = fully quantum-ready
  totalCryptoAssets: number;
  vulnerableCryptoAssets: number;
  highRiskAssets: number;
  mediumRiskAssets: number;
  lowRiskAssets: number;
  harvestNowDecryptLaterExposure: boolean;
  recommendedPriority: QuantumRiskLevel;
  summary?: string;
}

// ── Quantum Remediation Task ──────────────────────────────────────────────────

export interface QuantumRemediationTask {
  clientId: string;
  assessmentId?: string;
  inventoryId?: string;
  title: string;
  description: string;
  priority: QuantumRiskLevel;
  recommendedAction: string;
  targetStandard?: string;
  estimatedEffort?: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk" | "wont_fix";
}

// ── Quantum Policy Result ─────────────────────────────────────────────────────

export interface QuantumPolicyResult {
  clientId: string;
  inventoryId?: string;
  policyId: string;
  policyName: string;
  passed: boolean;
  severity: QuantumRiskLevel;
  message: string;
  evidence: Record<string, unknown>;
}

// ── Algorithm Profile (internal engine type) ──────────────────────────────────

export interface QuantumAlgorithmProfile {
  algorithmId: string;
  name: string;
  family: AlgorithmFamily;
  keyLengthBits?: number;
  vulnerabilityLevel: QuantumVulnerabilityLevel;
  estimatedYearsToThreat: number | null;
  nistPqcStandard?: string;
  isNistApproved: boolean;
  recommendedReplacements: string[];
  attackVectors: string[];
  cveReferences?: string[];
}

// ── Extended Asset Model (used internally by scoring engine) ──────────────────

export interface CryptoAsset {
  assetId: string;
  tenantId: string;
  scanRunId?: string;
  assetType: string;
  name: string;
  description?: string;
  system?: string;
  sensitivity: AssetSensitivity;
  algorithm: QuantumAlgorithmProfile;
  longTermConfidentiality: boolean;
  harvestNowRisk: boolean;
  location?: CryptoAssetLocation;
  expiresAt?: string;
  discoveredAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
}

export interface CryptoAssetLocation {
  cloud?: string;
  region?: string;
  service?: string;
  resourceArn?: string;
  hostname?: string;
  port?: number;
}

// ── Risk Assessment ───────────────────────────────────────────────────────────

export interface AssetQuantumRisk {
  assetId: string;
  vulnerabilityLevel: QuantumVulnerabilityLevel;
  riskScore: number;
  riskFactors: RiskFactor[];
  harvestNowRisk: boolean;
  migrationUrgency: "immediate" | "short_term" | "medium_term" | "long_term" | "none";
  mitigationStatus: MigrationStatus;
}

export interface RiskFactor {
  factorId: string;
  label: string;
  description: string;
  weight: number;
  value: number | boolean | string;
}

// ── Crypto Inventory ──────────────────────────────────────────────────────────

export interface CryptoInventory {
  tenantId: string;
  scanRunId?: string;
  generatedAt: string;
  assets: CryptoAsset[];
  summary: CryptoInventorySummary;
}

export interface CryptoInventorySummary {
  totalAssets: number;
  byVulnerabilityLevel: Record<QuantumVulnerabilityLevel, number>;
  byAlgorithmFamily: Record<AlgorithmFamily, number>;
  byAssetType: Record<string, number>;
  criticalHighCount: number;
  pqcAdoptedCount: number;
  harvestNowExposedCount: number;
}

// ── Quantum Readiness Score (scoring engine output) ───────────────────────────

export interface QuantumReadinessScore {
  tenantId: string;
  scanRunId?: string;
  calculatedAt: string;
  overallScore: number;
  grade: QuantumReadinessGrade;
  dimensionScores: QuantumReadinessDimensions;
  scoreDelta?: number;
  totalAssetsEvaluated: number;
  criticalVulnerabilities: number;
  pqcCoverage: number;
  summary: string;
}

export type QuantumReadinessGrade = "A" | "B" | "C" | "D" | "F";

export interface QuantumReadinessDimensions {
  algorithmRisk: number;
  keyHygiene: number;
  migrationProgress: number;
  harvestNowProtection: number;
  tlsPosture: number;
  vendorReadiness: number;
}

// ── Remediation Recommendation ────────────────────────────────────────────────

export interface RemediationRecommendation {
  recommendationId: string;
  tenantId: string;
  assetId?: string;
  priority: QuantumRiskLevel;
  category: RemediationCategory;
  title: string;
  description: string;
  actionItems: ActionItem[];
  targetAlgorithm?: string;
  estimatedEffortDays?: number;
  nistReferences?: string[];
  controlIds: string[];
  complianceGating: boolean;
  dueDate?: string;
}

export type RemediationCategory =
  | "algorithm_migration"
  | "key_rotation"
  | "tls_upgrade"
  | "certificate_replacement"
  | "pqc_adoption"
  | "vendor_engagement"
  | "policy_update"
  | "inventory_gap";

export interface ActionItem {
  step: number;
  description: string;
  tooling?: string;
  automated: boolean;
}

// ── Policy Mapping ────────────────────────────────────────────────────────────

export interface QuantumPolicyMapping {
  assetId?: string;
  findingId?: string;
  framework: string;
  controlId: string;
  controlTitle: string;
  applicability: "required" | "recommended" | "emerging";
  gapStatus: "compliant" | "gap" | "partial" | "not_applicable";
  evidence?: string;
  remediationRecommendationId?: string;
}

// ── Agent I/O ─────────────────────────────────────────────────────────────────

export interface QuantumReadinessAgentInput {
  tenantId: string;
  scanRunId?: string;
  rawFindings?: RawScanFinding[];
  cryptoAssets?: Partial<CryptoAsset>[];
  options?: QuantumAgentOptions;
}

export interface QuantumAgentOptions {
  includeVendorAssessment?: boolean;
  includeHarvestNowAnalysis?: boolean;
  frameworks?: string[];
  crqcYearsEstimate?: number;
}

export interface RawScanFinding {
  findingId: string;
  category: string;
  title: string;
  description?: string;
  severity: string;
  metadata?: Record<string, unknown>;
}

export interface QuantumReadinessAgentOutput {
  tenantId: string;
  scanRunId?: string;
  completedAt: string;
  inventory: CryptoInventory;
  riskAssessments: AssetQuantumRisk[];
  readinessScore: QuantumReadinessScore;
  remediationPlan: RemediationRecommendation[];
  policyMappings: QuantumPolicyMapping[];
  errors: AgentError[];
}

export interface AgentError {
  code: string;
  message: string;
  assetId?: string;
  recoverable: boolean;
}
