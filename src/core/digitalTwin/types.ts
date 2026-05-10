/**
 * Digital twin security state — canonical shapes for posture snapshots and diffs.
 * Synthetic / aggregated views; callers hydrate from Supabase or simulators.
 */

export type TwinEntityId = string;

/** Minimal asset node in the twin graph */
export type TwinAsset = {
  id: TwinEntityId;
  name: string;
  type: string;
  criticality?: "low" | "medium" | "high" | "critical";
  owner?: string;
  tags?: string[];
};

export type TwinVulnerability = {
  id: TwinEntityId;
  assetId?: TwinEntityId | null;
  cveId?: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  status: "open" | "acknowledged" | "in_remediation" | "resolved" | "risk_accepted";
};

export type TwinIdentity = {
  id: TwinEntityId;
  principal: string;
  kind: "user" | "service_account" | "role" | "group" | "unknown";
  riskFlags?: string[];
};

export type TwinExposedService = {
  id: TwinEntityId;
  assetId: TwinEntityId;
  protocol: string;
  port: number;
  exposure: "internet" | "external" | "internal" | "unknown";
  lastSeenAt?: string;
};

export type TwinPolicyState = {
  policyId: TwinEntityId;
  name: string;
  framework?: string | null;
  bindingCount?: number;
  lastEvaluatedAt?: string;
  posture: "compliant" | "non_compliant" | "unknown";
};

export type TwinCompliancePosture = {
  /** Stable row id for diffs; set by snapshot builder to `compliance:{framework}` when omitted */
  id?: TwinEntityId;
  framework: string;
  scorePct: number;
  failingControls: number;
  totalControls?: number;
  updatedAt?: string;
};

export type TwinIncident = {
  id: TwinEntityId;
  title: string;
  status: "open" | "contained" | "remediated" | "validated" | "closed";
  severity: "low" | "medium" | "high" | "critical";
  openedAt: string;
};

export type TwinRemediation = {
  id: TwinEntityId;
  findingId?: TwinEntityId | null;
  status: string;
  actionType?: string;
  updatedAt?: string;
};

/** Aggregate attack surface fingerprint (counts + hashes for diff) */
export type TwinAttackSurface = {
  internetFacingAssetIds: TwinEntityId[];
  exposedServiceIds: TwinEntityId[];
  openCriticalVulnIds: TwinEntityId[];
  /** Stable hash of sorted ids for quick equality */
  fingerprint: string;
};

export type TwinSecurityPostureSnapshot = {
  schema_version: "1.0.0";
  tenantId: string;
  capturedAt: string;
  sequence: number;
  /** 0–100 aggregate */
  riskScore: number;
  assets: TwinAsset[];
  vulnerabilities: TwinVulnerability[];
  identities: TwinIdentity[];
  exposedServices: TwinExposedService[];
  policyStates: TwinPolicyState[];
  compliancePosture: TwinCompliancePosture[];
  activeIncidents: TwinIncident[];
  remediations: TwinRemediation[];
  attackSurface: TwinAttackSurface;
  metadata?: Record<string, unknown>;
};

export type TwinDiffKind =
  | "added"
  | "removed"
  | "changed"
  | "unchanged"
  | "attack_surface_expanded"
  | "attack_surface_contracted";

export type TwinFieldDiff = {
  path: string;
  before?: unknown;
  after?: unknown;
};

export type TwinEntityDiff = {
  entityType: string;
  entityId: TwinEntityId;
  kind: TwinDiffKind;
  fields?: TwinFieldDiff[];
  summary?: string;
};

export type TwinSecurityPostureDiff = {
  fromSequence: number;
  toSequence: number;
  fromCapturedAt: string;
  toCapturedAt: string;
  riskScoreDelta: number;
  entities: TwinEntityDiff[];
  attackSurfaceChanged: boolean;
  summaryLines: string[];
};

export type TwinAttackPathStep = {
  stepIndex: number;
  fromKind: string;
  fromId: TwinEntityId;
  toKind: string;
  toId: TwinEntityId;
  edge: "exposes" | "authenticates" | "affects" | "targets";
  label?: string;
};

export type TwinAttackPath = {
  id: string;
  steps: TwinAttackPathStep[];
  severity: "low" | "medium" | "high" | "critical";
  discoveredAt: string;
};

export type TwinSimulationOverlay = {
  overlayId: string;
  label: string;
  /** Deltas applied on top of a base snapshot when materializing */
  assetPatches?: Array<Partial<TwinAsset> & { id: TwinEntityId }>;
  additionalVulnerabilities?: TwinVulnerability[];
  additionalExposedServices?: TwinExposedService[];
  riskScoreAdjustment?: number;
  metadata?: Record<string, unknown>;
};
