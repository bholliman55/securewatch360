/**
 * Attack path visualization — pure data structures for graph, timeline, and dashboard consumers.
 * Synthetic / analytical only; does not execute or imply real intrusions.
 */

/** Cyber Kill Chain style ordering (Lockheed Martin inspired, 7 stages). */
export type KillChainStage =
  | "reconnaissance"
  | "weaponization"
  | "delivery"
  | "exploitation"
  | "installation"
  | "command_and_control"
  | "actions_on_objectives";

export type ExposureTier = "internet" | "external" | "partner" | "internal" | "isolated";

export interface AttackPathAssetNode {
  id: string;
  label: string;
  asset_type: string;
  exposure: ExposureTier;
  metadata?: Record<string, unknown>;
}

export type RemediationOverlayStatus = "planned" | "in_progress" | "completed" | "blocked";

export interface AttackPathRemediationOverlay {
  id: string;
  status: RemediationOverlayStatus;
  label: string;
  /** Populated when status is blocked. */
  blocked_reason?: string;
}

export interface AttackPathStep {
  id: string;
  /** Ordering key for timeline and progression edges (duplicate orders are sorted by id). */
  order: number;
  title: string;
  description?: string;
  /** MITRE ATT&CK technique ids, e.g. T1566, T1190. */
  mitre_techniques?: string[];
  /** Required lane for kill-chain visualization. */
  kill_chain_stage: KillChainStage;
  affected_asset_ids: string[];
  policy_failed?: boolean;
  policy_rule_id?: string;
  policy_summary?: string;
  remediation?: AttackPathRemediationOverlay;
  /** When true, progression stops after this step (control or operator block). */
  chain_blocked?: boolean;
  blocked_reason?: string;
}

export interface AttackPathScenario {
  id: string;
  name: string;
  tenant_id: string;
  /** ISO 8601 anchor for synthetic timeline offsets. */
  started_at: string;
  assets: AttackPathAssetNode[];
  steps: AttackPathStep[];
}

export type AttackPathGraphNodeType =
  | "asset"
  | "attack_step"
  | "policy_failure"
  | "remediation"
  | "chain_block";

export interface AttackPathGraphNode {
  id: string;
  type: AttackPathGraphNodeType;
  label: string;
  meta: Record<string, unknown>;
}

export type AttackPathGraphEdgeKind =
  | "progression"
  | "affects"
  | "policy_failure"
  | "remediation_overlay"
  | "blocks_chain";

export interface AttackPathGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: AttackPathGraphEdgeKind;
  meta?: Record<string, unknown>;
}

export type BlastRadiusBand = "low" | "medium" | "high" | "critical";

export interface BlastRadiusEstimate {
  score_0_100: number;
  band: BlastRadiusBand;
  /** Human-readable factors for dashboard tooltips. */
  factors: string[];
  affected_asset_count: number;
  internet_exposed_asset_count: number;
}

export interface MitreOverlayEntry {
  technique_id: string;
  tactic_id: string;
  tactic_label: string;
  step_ids: string[];
}

export interface KillChainLaneSlice {
  stage: KillChainStage;
  label: string;
  step_ids: string[];
}

export interface AttackPathGraphJson {
  schema_version: 1;
  scenario_id: string;
  tenant_id: string;
  generated_at_iso: string;
  nodes: AttackPathGraphNode[];
  edges: AttackPathGraphEdge[];
  mitre_overlay: MitreOverlayEntry[];
  kill_chain_lanes: KillChainLaneSlice[];
  blast_radius: BlastRadiusEstimate;
}

export type AttackPathTimelineEventType =
  | "progression"
  | "policy_failure"
  | "remediation"
  | "blocked";

export interface AttackPathTimelineEntry {
  offset_minutes: number;
  at_iso: string;
  step_id: string;
  title: string;
  kill_chain_stage: KillChainStage;
  mitre_techniques: string[];
  event_type: AttackPathTimelineEventType;
  affected_asset_ids: string[];
  chain_blocked: boolean;
}

export interface AttackPathTimelineJson {
  schema_version: 1;
  scenario_id: string;
  tenant_id: string;
  anchor_iso: string;
  entries: AttackPathTimelineEntry[];
}

export interface AttackPathDashboardSummary {
  total_steps: number;
  total_assets: number;
  policy_failure_count: number;
  remediation_count: number;
  blocked_chain: boolean;
  blocked_at_step_id: string | null;
  distinct_mitre_techniques: number;
}

/** Single bundle for console / API responses. */
export interface AttackPathDashboardModel {
  schema_version: 1;
  scenario_id: string;
  tenant_id: string;
  name: string;
  summary: AttackPathDashboardSummary;
  graph: AttackPathGraphJson;
  timeline: AttackPathTimelineJson;
}
