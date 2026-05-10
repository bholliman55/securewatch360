import { estimateBlastRadius } from "./blastRadius";
import { killChainStageLabel, KILL_CHAIN_ORDER } from "./killChain";
import { resolveMitreTacticId, resolveMitreTacticLabel } from "./mitre";
import type {
  AttackPathDashboardModel,
  AttackPathDashboardSummary,
  AttackPathGraphEdge,
  AttackPathGraphJson,
  AttackPathGraphNode,
  AttackPathScenario,
  AttackPathStep,
  AttackPathTimelineEntry,
  AttackPathTimelineJson,
  KillChainLaneSlice,
  MitreOverlayEntry,
} from "./types";

function sortedSteps(steps: AttackPathStep[]): AttackPathStep[] {
  return [...steps].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
}

function timelineEventType(step: AttackPathStep): AttackPathTimelineEntry["event_type"] {
  if (step.chain_blocked) return "blocked";
  if (step.policy_failed) return "policy_failure";
  if (step.remediation) return "remediation";
  return "progression";
}

function buildKillChainLanes(steps: AttackPathStep[]): KillChainLaneSlice[] {
  const byStage = new Map<string, string[]>();
  for (const stage of KILL_CHAIN_ORDER) {
    byStage.set(stage, []);
  }
  for (const s of steps) {
    const list = byStage.get(s.kill_chain_stage);
    if (list) list.push(s.id);
  }
  return KILL_CHAIN_ORDER.map((stage) => ({
    stage,
    label: killChainStageLabel(stage),
    step_ids: byStage.get(stage) ?? [],
  }));
}

function buildMitreOverlay(steps: AttackPathStep[]): MitreOverlayEntry[] {
  const byTechnique = new Map<string, Set<string>>();
  for (const s of steps) {
    for (const tech of s.mitre_techniques ?? []) {
      const key = tech.trim().toUpperCase();
      if (!byTechnique.has(key)) byTechnique.set(key, new Set());
      byTechnique.get(key)!.add(s.id);
    }
  }

  const entries: MitreOverlayEntry[] = [];
  for (const [technique_id, stepSet] of byTechnique) {
    const tactic_id = resolveMitreTacticId(technique_id);
    entries.push({
      technique_id,
      tactic_id,
      tactic_label: resolveMitreTacticLabel(technique_id),
      step_ids: [...stepSet].sort((a, b) => a.localeCompare(b)),
    });
  }
  return entries.sort((a, b) => a.technique_id.localeCompare(b.technique_id));
}

function buildGraphNodesAndEdges(scenario: AttackPathScenario, steps: AttackPathStep[]): { nodes: AttackPathGraphNode[]; edges: AttackPathGraphEdge[] } {
  const nodes: AttackPathGraphNode[] = [];
  const edges: AttackPathGraphEdge[] = [];
  let edgeSeq = 0;
  const edgeId = () => `e-${++edgeSeq}`;

  for (const asset of scenario.assets) {
    nodes.push({
      id: `asset:${asset.id}`,
      type: "asset",
      label: asset.label,
      meta: {
        asset_id: asset.id,
        asset_type: asset.asset_type,
        exposure: asset.exposure,
        ...(asset.metadata ?? {}),
      },
    });
  }

  for (const step of steps) {
    nodes.push({
      id: `step:${step.id}`,
      type: "attack_step",
      label: step.title,
      meta: {
        step_id: step.id,
        order: step.order,
        kill_chain_stage: step.kill_chain_stage,
        mitre_techniques: step.mitre_techniques ?? [],
        policy_failed: step.policy_failed ?? false,
        chain_blocked: step.chain_blocked ?? false,
        ...(step.description ? { description: step.description } : {}),
      },
    });

    for (const assetId of step.affected_asset_ids) {
      edges.push({
        id: edgeId(),
        source: `step:${step.id}`,
        target: `asset:${assetId}`,
        kind: "affects",
        meta: { step_id: step.id, asset_id: assetId },
      });
    }

    if (step.policy_failed) {
      const pid = `policy:${step.id}`;
      nodes.push({
        id: pid,
        type: "policy_failure",
        label: step.policy_summary ?? "Policy failure",
        meta: {
          step_id: step.id,
          ...(step.policy_rule_id ? { policy_rule_id: step.policy_rule_id } : {}),
        },
      });
      edges.push({
        id: edgeId(),
        source: `step:${step.id}`,
        target: pid,
        kind: "policy_failure",
      });
    }

    if (step.remediation) {
      const rid = `remediation:${step.id}:${step.remediation.id}`;
      nodes.push({
        id: rid,
        type: "remediation",
        label: step.remediation.label,
        meta: {
          step_id: step.id,
          remediation_id: step.remediation.id,
          status: step.remediation.status,
          ...(step.remediation.blocked_reason ? { blocked_reason: step.remediation.blocked_reason } : {}),
        },
      });
      edges.push({
        id: edgeId(),
        source: `step:${step.id}`,
        target: rid,
        kind: "remediation_overlay",
      });
    }

    if (step.chain_blocked) {
      const bid = `block:${step.id}`;
      nodes.push({
        id: bid,
        type: "chain_block",
        label: "Blocked",
        meta: {
          step_id: step.id,
          ...(step.blocked_reason ? { reason: step.blocked_reason } : {}),
        },
      });
      edges.push({
        id: edgeId(),
        source: `step:${step.id}`,
        target: bid,
        kind: "blocks_chain",
      });
    }
  }

  for (let i = 0; i < steps.length - 1; i += 1) {
    const cur = steps[i]!;
    const next = steps[i + 1]!;
    if (cur.chain_blocked) continue;
    if (next.chain_blocked) {
      edges.push({
        id: edgeId(),
        source: `step:${cur.id}`,
        target: `block:${next.id}`,
        kind: "blocks_chain",
        meta: { blocked_step_id: next.id },
      });
      continue;
    }
    edges.push({
      id: edgeId(),
      source: `step:${cur.id}`,
      target: `step:${next.id}`,
      kind: "progression",
    });
  }

  return { nodes, edges };
}

function buildTimeline(scenario: AttackPathScenario, steps: AttackPathStep[], offsetMinutesPerStep: number): AttackPathTimelineJson {
  const anchor = new Date(scenario.started_at);
  const entries: AttackPathTimelineEntry[] = steps.map((step, idx) => {
    const at = new Date(anchor.getTime() + idx * offsetMinutesPerStep * 60_000);
    return {
      offset_minutes: idx * offsetMinutesPerStep,
      at_iso: at.toISOString(),
      step_id: step.id,
      title: step.title,
      kill_chain_stage: step.kill_chain_stage,
      mitre_techniques: step.mitre_techniques ?? [],
      event_type: timelineEventType(step),
      affected_asset_ids: [...step.affected_asset_ids],
      chain_blocked: step.chain_blocked ?? false,
    };
  });

  return {
    schema_version: 1,
    scenario_id: scenario.id,
    tenant_id: scenario.tenant_id,
    anchor_iso: scenario.started_at,
    entries,
  };
}

function buildSummary(scenario: AttackPathScenario, steps: AttackPathStep[]): AttackPathDashboardSummary {
  const techniques = new Set<string>();
  for (const s of steps) {
    for (const t of s.mitre_techniques ?? []) {
      techniques.add(t.trim().toUpperCase());
    }
  }

  let blockedAt: string | null = null;
  for (const s of steps) {
    if (s.chain_blocked) {
      blockedAt = s.id;
      break;
    }
  }

  return {
    total_steps: steps.length,
    total_assets: scenario.assets.length,
    policy_failure_count: steps.filter((s) => s.policy_failed).length,
    remediation_count: steps.filter((s) => s.remediation).length,
    blocked_chain: steps.some((s) => s.chain_blocked),
    blocked_at_step_id: blockedAt,
    distinct_mitre_techniques: techniques.size,
  };
}

export type BuildAttackPathVisualizationOptions = {
  /** Minutes between synthetic timeline ticks (default 5). */
  timelineStepMinutes?: number;
};

/**
 * Build graph JSON, timeline JSON, and a dashboard-ready bundle from a declarative attack-path scenario.
 */
export function buildAttackPathVisualization(
  scenario: AttackPathScenario,
  options?: BuildAttackPathVisualizationOptions,
): AttackPathDashboardModel {
  const steps = sortedSteps(scenario.steps);
  const offsetMinutes = options?.timelineStepMinutes ?? 5;
  const blast = estimateBlastRadius(scenario.assets, steps);
  const { nodes, edges } = buildGraphNodesAndEdges(scenario, steps);
  const kill_chain_lanes = buildKillChainLanes(steps);
  const mitre_overlay = buildMitreOverlay(steps);

  const graph: AttackPathGraphJson = {
    schema_version: 1,
    scenario_id: scenario.id,
    tenant_id: scenario.tenant_id,
    generated_at_iso: new Date().toISOString(),
    nodes,
    edges,
    mitre_overlay,
    kill_chain_lanes,
    blast_radius: blast,
  };

  const timeline = buildTimeline(scenario, steps, offsetMinutes);

  return {
    schema_version: 1,
    scenario_id: scenario.id,
    tenant_id: scenario.tenant_id,
    name: scenario.name,
    summary: buildSummary(scenario, steps),
    graph,
    timeline,
  };
}
