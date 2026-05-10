import { describe, expect, it } from "vitest";
import {
  reconstructForensicTimeline,
  replayForensicTimelineStepwise,
  exportTimelineAsJson,
} from "../forensics/timelineReconstructor";
import type { SimulationResult, SimulationRun } from "../types";
import type { ScenarioDefinition } from "../schema";

const minimalScenario: ScenarioDefinition = {
  id: "lab-test-scenario",
  name: "Lab test",
  description: "Synthetic only",
  severity: "high",
  attack_category: "phishing",
  mitre_attack_techniques: ["T1566"],
  target_type: "endpoint",
  simulated_events: [
    { ref: "a", kind: "monitoring.alert.synthetic", payload: { title: "Alert A", severity: "high" } },
    { ref: "b", kind: "finding.synthetic", payload: { title: "Finding B" } },
  ],
  expected_agent_sequence: [
    { id: "step-1", agent_key: "decision-engine", capability: "evaluate", match: {} },
  ],
  expected_controls_triggered: [{ framework: "nist_csf", control_id: "PR.IP-1" }],
  expected_remediation: { summary: "stub" },
  expected_report_sections: ["summary"],
  pass_fail_rules: {
    agent_sequence_order_required: false,
    all_report_sections_required: false,
    require_all_agent_steps: false,
  },
  assurance: "synthetic_metadata_only",
};

function buildRun(): SimulationRun {
  const runId = "00000000-0000-4000-8000-00000000a001";
  const t0 = "2026-05-10T12:00:00.000Z";
  const t1 = "2026-05-10T12:00:05.000Z";
  return {
    id: runId,
    scenarioId: minimalScenario.id,
    startedAt: t0,
    completedAt: t1,
    environment: "local",
    events: [
      {
        id: `evt-${runId}-b`,
        scenarioId: minimalScenario.id,
        runId,
        kind: "finding.synthetic",
        simulatedAt: t1,
        payload: { title: "Second" },
      },
      {
        id: `evt-${runId}-a`,
        scenarioId: minimalScenario.id,
        runId,
        kind: "monitoring.alert.synthetic",
        simulatedAt: t0,
        payload: { title: "First" },
      },
    ],
  };
}

describe("timelineReconstructor", () => {
  it("orders synthetic events chronologically and assigns trace_id + event_hash", () => {
    const run = buildRun();
    const result: SimulationResult = {
      runId: run.id,
      scenarioId: minimalScenario.id,
      passed: false,
      validations: [
        {
          expectationId: "step-1",
          passed: false,
          detail: "No audit correlation (local mode)",
        },
      ],
      summary: "fail",
      finishedAt: run.completedAt!,
    };

    const doc = reconstructForensicTimeline({
      run,
      result,
      scenario: minimalScenario,
      emissions: [{ mode: "local" }, { mode: "local" }],
    });

    expect(doc.simulation_run_id).toBe(run.id);
    expect(doc.events.length).toBeGreaterThanOrEqual(2);
    const synthetic = doc.events.filter((e) => e.lane === "synthetic_emit");
    expect(synthetic).toHaveLength(2);
    expect(synthetic[0].simulation_event_id).toContain("evt-");
    expect(synthetic[0].trace_id).toBe(`trace:${run.id}`);
    expect(synthetic[0].event_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(synthetic[0].parent_event_id).toBeNull();
    expect(synthetic[1].parent_event_id).toBe(synthetic[0].simulation_event_id);
    expect(doc.event_transitions.some((t) => t.transition_kind === "synthetic_emit")).toBe(true);
    expect(doc.anomalies.missing_workflow_transitions.some((m) => m.expectation_id === "step-1")).toBe(true);
    expect(doc.incident_reconstruction_markdown).toContain("Incident reconstruction");
  });

  it("replayForensicTimelineStepwise yields the same count as doc.events", () => {
    const run = buildRun();
    const result: SimulationResult = {
      runId: run.id,
      scenarioId: minimalScenario.id,
      passed: true,
      validations: [{ expectationId: "step-1", passed: true, detail: "ok" }],
      summary: "ok",
      finishedAt: run.completedAt!,
    };
    const doc = reconstructForensicTimeline({ run, result, scenario: minimalScenario });
    const steps = [...replayForensicTimelineStepwise(doc)];
    expect(steps.length).toBe(doc.events.length);
  });

  it("exportTimelineAsJson round-trips schema_version", () => {
    const run = buildRun();
    const result: SimulationResult = {
      runId: run.id,
      scenarioId: minimalScenario.id,
      passed: true,
      validations: [],
      summary: "ok",
      finishedAt: run.completedAt!,
    };
    const doc = reconstructForensicTimeline({ run, result, scenario: minimalScenario });
    const parsed = JSON.parse(exportTimelineAsJson(doc)) as { schema_version: number };
    expect(parsed.schema_version).toBe(1);
  });
});
