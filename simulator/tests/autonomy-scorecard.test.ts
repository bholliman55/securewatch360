import { describe, expect, it } from "vitest";
import { computeAutonomyScorecard, describeAutonomyReadiness } from "../reports/autonomyScorecard";
import type { ScenarioDefinition } from "../schema";
import type { SimulationResult } from "../types";
import type { CollectedSignals } from "../engineSignals.types";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";

const minimalScenario: ScenarioDefinition = {
  id: "scorecard-fixture-lab",
  name: "Scorecard fixture",
  description: "Synthetic scenario for autonomy score helpers.",
  assurance: "synthetic_metadata_only",
  severity: "medium",
  attack_category: "suspicious_login",
  mitre_attack_techniques: [],
  target_type: "user_identity",
  simulated_events: [
    {
      ref: "evt-a",
      kind: "finding.synthetic",
      payload: { title: "Lab finding", severity: "medium", category: "lab" },
    },
  ],
  expected_agent_sequence: [
    {
      id: "step-01",
      agent_key: "decision-engine",
      capability: "evaluation_stub",
      match: {},
    },
  ],
  expected_controls_triggered: [],
  expected_remediation: {
    summary: "Stub remediation",
    human_in_the_loop: true,
  },
  expected_report_sections: ["executive_summary", "remediation_plan"],
  pass_fail_rules: {
    agent_sequence_order_required: false,
    all_report_sections_required: false,
    require_all_agent_steps: false,
  },
};

function baseSignals(local = true): CollectedSignals {
  const start = "2026-05-02T18:00:00.000Z";
  const end = "2026-05-02T18:03:45.000Z";
  return {
    observationWindowStartIso: start,
    observationWindowEndIso: end,
    pollIterations: local ? 0 : 2,
    auditRowsForRun: local ? [] : [],
    auditRowsNearTimeline: [],
  };
}

const agentsAllPassing: AgentValidatorResult[] = [
  { agentId: "agent-1", passed: true, score: 100, failures: [], warnings: [], evidence: {} },
  { agentId: "agent-2", passed: true, score: 100, failures: [], warnings: [], evidence: {} },
];

describe("computeAutonomyScorecard", () => {
  it("returns bounded rates and readiness band tied to overall score", () => {
    const result: SimulationResult = {
      runId: "run-x",
      scenarioId: minimalScenario.id,
      passed: true,
      validations: [
        {
          expectationId: "step-01",
          passed: true,
          detail: "ok",
          observed: {},
        },
        {
          expectationId: "aggregation-controls",
          passed: true,
          detail: "controls ok",
          observed: {},
        },
      ],
      summary: "[simulation:x] PASS",
      finishedAt: "2026-05-02T18:07:12.000Z",
    };

    const runInput = {
      id: result.runId,
      startedAt: "2026-05-02T18:00:00.100Z",
      completedAt: "2026-05-02T18:06:59.999Z",
      events: [
        {
          id: `evt-${result.runId}-evt-a`,
          scenarioId: minimalScenario.id,
          runId: result.runId,
          kind: "finding.synthetic" as const,
          simulatedAt: "2026-05-02T18:00:00.200Z",
          payload: { title: "Lab finding" },
        },
      ],
    };

    const card = computeAutonomyScorecard({
      scenario: minimalScenario,
      result,
      run: runInput,
      signals: baseSignals(),
      securewatchAgents: agentsAllPassing,
    });

    expect(card.overall_autonomy_score).toBeGreaterThanOrEqual(0);
    expect(card.overall_autonomy_score).toBeLessThanOrEqual(100);
    expect(card.detection_success_rate).toBeGreaterThanOrEqual(0);
    expect(card.detection_success_rate).toBeLessThanOrEqual(1);
    expect(card.agent_trigger_accuracy).toBeGreaterThanOrEqual(0);
    expect(card.agent_trigger_accuracy).toBeLessThanOrEqual(1);
    expect(card.false_positive_risk).toBeGreaterThanOrEqual(0);
    expect(card.false_positive_risk).toBeLessThanOrEqual(1);
    expect(describeAutonomyReadiness(card.overall_autonomy_score)).toBe(card.readiness_band);
    expect(card.time_to_triage_seconds).not.toBeNull();
  });

  it("marks lower autonomy when validations fail broadly", () => {
    const result: SimulationResult = {
      runId: "run-fail",
      scenarioId: minimalScenario.id,
      passed: false,
      validations: [
        { expectationId: "step-01", passed: false, detail: "miss", observed: {} },
        { expectationId: "aggregation-controls", passed: false, detail: "miss", observed: {} },
      ],
      summary: "[simulation:y] FAIL",
      finishedAt: "2026-05-02T18:07:12.000Z",
    };

    const good = computeAutonomyScorecard({
      scenario: minimalScenario,
      result: {
        ...result,
        passed: true,
        validations: result.validations.map((v) => ({ ...v, passed: true })),
      },
      run: {
        id: result.runId,
        startedAt: "2026-05-02T18:00:00.100Z",
        completedAt: "2026-05-02T18:06:59.999Z",
        events: [],
      },
      signals: baseSignals(),
      securewatchAgents: agentsAllPassing,
    });

    const bad = computeAutonomyScorecard({
      scenario: minimalScenario,
      result,
      run: {
        id: result.runId,
        startedAt: "2026-05-02T18:00:00.100Z",
        completedAt: "2026-05-02T18:06:59.999Z",
        events: [],
      },
      signals: baseSignals(),
      securewatchAgents: agentsAllPassing,
    });

    expect(bad.overall_autonomy_score).toBeLessThan(good.overall_autonomy_score);
    expect(describeAutonomyReadiness(bad.overall_autonomy_score)).toBeTruthy();
  });
});
