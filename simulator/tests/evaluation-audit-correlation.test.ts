import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import type { ScenarioDefinition } from "../schema";
import type { SimulationAuditRow } from "../engineSignals.types";
import { evaluateScenarioExpectations } from "../engines/resultCollector";

/** Minimal synthetic scenario wired to correlate with seeded audit blobs. */
const scenarioWithCorrelation: ScenarioDefinition = {
  id: "eval-mock-001",
  name: "Evaluation mock scenario",
  description: "Unit test scenario for expectation evaluation.",
  assurance: "synthetic_metadata_only",
  severity: "low",
  attack_category: "suspicious_login",
  mitre_attack_techniques: [],
  target_type: "user_identity",
  simulated_events: [
    {
      kind: "monitoring.alert.synthetic",
      payload: { alert_type: "lab.eval", severity: "low" },
    },
  ],
  expected_agent_sequence: [
    {
      id: "step-a",
      agent_key: "decision-engine",
      capability: "evaluation_record_written",
      match: {},
    },
  ],
  expected_controls_triggered: [],
  expected_remediation: { summary: "noop" },
  expected_report_sections: ["executive_summary"],
  pass_fail_rules: {
    agent_sequence_order_required: false,
    all_report_sections_required: false,
    min_controls_matched: 0,
    require_all_agent_steps: false,
  },
};

describe("evaluateScenarioExpectations — audit correlation (local mocks)", () => {
  function auditRow(note: string): SimulationAuditRow {
    return {
      id: randomUUID(),
      action: "simulation.ingest_fixture",
      payload: { correlation_note: note },
      created_at: new Date().toISOString(),
    };
  }

  it("marks agent expectation passed when haystack mentions underscored agent + capability slug", () => {
    const note = "replay decision_engine evaluation_record_written for lab";
    const result = evaluateScenarioExpectations({
      scenario: scenarioWithCorrelation,
      runId: "run-eval-1",
      signals: {
        observationWindowStartIso: new Date().toISOString(),
        observationWindowEndIso: new Date().toISOString(),
        pollIterations: 0,
        auditRowsForRun: [auditRow(note)],
        auditRowsNearTimeline: [],
      },
    });

    const step = result.validations.find((v) => v.expectationId === "step-a");
    expect(step?.passed).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("fails optimistic path when audits lack correlation strings", () => {
    const result = evaluateScenarioExpectations({
      scenario: scenarioWithCorrelation,
      runId: "run-eval-2",
      signals: {
        observationWindowStartIso: new Date().toISOString(),
        observationWindowEndIso: new Date().toISOString(),
        pollIterations: 3,
        auditRowsForRun: [],
        auditRowsNearTimeline: [],
      },
    });

    expect(result.passed).toBe(false);
  });
});
