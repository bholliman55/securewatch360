/**
 * SecureWatch360 — Posture Roadmap domain models.
 * Defines current state, target state, gap analysis, and roadmap item types.
 */

// ────────────────────────────────────────────────────────────────────────────
// Enums & union types
// ────────────────────────────────────────────────────────────────────────────

export const ROADMAP_CATEGORIES = [
  "identity_access",
  "endpoint_security",
  "network_security",
  "vulnerability_management",
  "backup_recovery",
  "monitoring_logging",
  "compliance_evidence",
  "security_awareness",
  "incident_response",
] as const;

export type RoadmapCategory = (typeof ROADMAP_CATEGORIES)[number];

export const ROADMAP_CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  identity_access: "Identity & Access",
  endpoint_security: "Endpoint Security",
  network_security: "Network Security",
  vulnerability_management: "Vulnerability Management",
  backup_recovery: "Backup & Recovery",
  monitoring_logging: "Monitoring & Logging",
  compliance_evidence: "Compliance Evidence",
  security_awareness: "Security Awareness Training",
  incident_response: "Incident Response",
};

export const ROADMAP_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type RoadmapPriority = (typeof ROADMAP_PRIORITIES)[number];

export const ROADMAP_EFFORTS = ["low", "medium", "high"] as const;
export type RoadmapEffort = (typeof ROADMAP_EFFORTS)[number];

export const ROADMAP_AUTOMATION_LEVELS = ["now", "later", "not_yet"] as const;
export type RoadmapAutomationLevel = (typeof ROADMAP_AUTOMATION_LEVELS)[number];

export const ROADMAP_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

// ────────────────────────────────────────────────────────────────────────────
// DB row types
// ────────────────────────────────────────────────────────────────────────────

export interface PostureRoadmapItem {
  id: string;
  tenant_id: string;
  title: string;
  category: RoadmapCategory;
  related_framework: string | null;
  current_state: string | null;
  desired_state: string | null;
  priority: RoadmapPriority;
  estimated_effort: RoadmapEffort;
  estimated_impact_score: number;
  recommended_action: string | null;
  automation_level: RoadmapAutomationLevel;
  status: RoadmapStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PostureTargetConfig {
  id: string;
  tenant_id: string;
  target_framework: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Computed view models
// ────────────────────────────────────────────────────────────────────────────

export interface FrameworkReadiness {
  framework: string;
  displayName: string;
  readinessPercent: number;
  controlsPass: number;
  controlsTotal: number;
  requiredMaturityScore: number;
  gapToRequired: number;
}

export interface TopRisk {
  findingId: string;
  title: string;
  severity: string;
  category: string | null;
  priorityScore: number;
  status: string;
  assetType: string;
}

export interface PostureCurrentState {
  maturityScore: number;
  maturityLabel: string;
  frameworkReadiness: FrameworkReadiness[];
  topRisks: TopRisk[];
  missingControlsCount: number;
  exposedAssetsCount: number;
  unresolvedFindingsCount: number;
  criticalFindingsCount: number;
  highFindingsCount: number;
  identityGapsCount: number;
}

export interface RequiredControl {
  controlCode: string;
  controlTitle: string;
  status: "met" | "gap";
}

export interface PostureTargetState {
  targetFramework: string;
  targetFrameworkDisplayName: string;
  requiredMaturityScore: number;
  currentMaturityScore: number;
  distanceToReadiness: number;
  currentGapCount: number;
  requiredControlCount: number;
  metControlCount: number;
  keyRequiredControls: RequiredControl[];
}

export interface GapItem {
  category: RoadmapCategory;
  categoryLabel: string;
  gapCount: number;
  criticalCount: number;
  highCount: number;
  items: PostureRoadmapItem[];
}

export interface PostureRoadmapSummary {
  currentState: PostureCurrentState;
  targetState: PostureTargetState;
  gaps: GapItem[];
  totalRoadmapItems: number;
  criticalItems: number;
  highItems: number;
  completedItems: number;
  inProgressItems: number;
  automationAvailableCount: number;
}

// ────────────────────────────────────────────────────────────────────────────
// API request/response types
// ────────────────────────────────────────────────────────────────────────────

export interface UpdateRoadmapItemRequest {
  status?: RoadmapStatus;
  priority?: RoadmapPriority;
  notes?: string;
}

export interface RoadmapItemUpdateResult {
  ok: boolean;
  item?: PostureRoadmapItem;
  error?: string;
}
