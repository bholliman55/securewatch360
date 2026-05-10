import { describe, expect, it } from "vitest";
import { buildAttackPathVisualization } from "./buildModel";
import { estimateBlastRadius } from "./blastRadius";
import { resolveMitreTacticId } from "./mitre";
import type { AttackPathScenario } from "./types";

const baseScenario = (): AttackPathScenario => ({
  id: "path-demo-1",
  name: "Phishing to execution (lab)",
  tenant_id: "tenant-uuid-1",
  started_at: "2026-05-07T12:00:00.000Z",
  assets: [
    {
      id: "host-a",
      label: "Finance workstation",
      asset_type: "host",
      exposure: "internal",
    },
    {
      id: "host-edge",
      label: "Internet-facing proxy",
      asset_type: "host",
      exposure: "internet",
    },
  ],
  steps: [
    {
      id: "s1",
      order: 1,
      title: "User receives lure",
      kill_chain_stage: "delivery",
      mitre_techniques: ["T1566"],
      affected_asset_ids: ["host-a"],
    },
    {
      id: "s2",
      order: 2,
      title: "Payload executes",
      kill_chain_stage: "exploitation",
      mitre_techniques: ["T1059"],
      affected_asset_ids: ["host-a"],
      policy_failed: true,
      policy_rule_id: "pol-execution-guard",
      policy_summary: "Execution guardrail not enforced",
      remediation: {
        id: "rem-1",
        status: "planned",
        label: "Isolate host and revoke session",
      },
    },
    {
      id: "s3",
      order: 3,
      title: "Lateral movement attempt",
      kill_chain_stage: "installation",
      mitre_techniques: ["T1021"],
      affected_asset_ids: ["host-edge"],
      chain_blocked: true,
      blocked_reason: "Network segmentation blocked SMB relay path",
    },
  ],
});

describe("buildAttackPathVisualization", () => {
  it("produces graph, timeline, and dashboard summary", () => {
    const model = buildAttackPathVisualization(baseScenario(), { timelineStepMinutes: 10 });

    expect(model.schema_version).toBe(1);
    expect(model.summary.total_steps).toBe(3);
    expect(model.summary.policy_failure_count).toBe(1);
    expect(model.summary.remediation_count).toBe(1);
    expect(model.summary.blocked_chain).toBe(true);
    expect(model.summary.blocked_at_step_id).toBe("s3");

    expect(model.graph.nodes.some((n) => n.type === "asset")).toBe(true);
    expect(model.graph.nodes.some((n) => n.type === "policy_failure")).toBe(true);
    expect(model.graph.nodes.some((n) => n.type === "remediation")).toBe(true);
    expect(model.graph.nodes.some((n) => n.type === "chain_block")).toBe(true);

    const progression = model.graph.edges.filter((e) => e.kind === "progression");
    expect(progression.some((e) => e.source === "step:s1" && e.target === "step:s2")).toBe(true);
    expect(progression.some((e) => e.source === "step:s2" && e.target === "step:s3")).toBe(false);

    expect(model.timeline.entries).toHaveLength(3);
    expect(model.timeline.entries[0]!.offset_minutes).toBe(0);
    expect(model.timeline.entries[1]!.offset_minutes).toBe(10);
    expect(model.timeline.entries[1]!.event_type).toBe("policy_failure");
    expect(model.timeline.entries[2]!.event_type).toBe("blocked");
  });

  it("includes MITRE overlay aggregated by technique", () => {
    const model = buildAttackPathVisualization(baseScenario());
    const t1566 = model.graph.mitre_overlay.find((m) => m.technique_id === "T1566");
    expect(t1566?.step_ids).toContain("s1");
    expect(resolveMitreTacticId("T1566")).toBe("initial-access");
  });

  it("groups kill-chain lanes by stage", () => {
    const model = buildAttackPathVisualization(baseScenario());
    const delivery = model.graph.kill_chain_lanes.find((l) => l.stage === "delivery");
    expect(delivery?.step_ids).toContain("s1");
  });
});

describe("estimateBlastRadius", () => {
  it("scores higher when internet-exposed assets are in scope", () => {
    const scenario = baseScenario();
    const low = estimateBlastRadius(scenario.assets, scenario.steps.slice(0, 1));
    const full = estimateBlastRadius(scenario.assets, scenario.steps);
    expect(full.score_0_100).toBeGreaterThanOrEqual(low.score_0_100);
    expect(full.internet_exposed_asset_count).toBeGreaterThanOrEqual(1);
  });
});
