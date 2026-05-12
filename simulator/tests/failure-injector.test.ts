import { describe, it, expect } from "vitest";
import {
  applyDuplicateEventInjection,
  injectAgentValidatorFailures,
  mergeFailureInjectionIntoSimulationResult,
  resolveSimulationTargetAgentId,
  shouldSimulateDatabaseInsertFailure,
} from "../engines/failureInjector";
import { AGENT_1_ID } from "../validators";
import type { ScenarioDefinition } from "../schema";

function baseScenario(over: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id: "failure-inj-fixture",
    name: "Fixture",
    description: "Synthetic fixture for failure injection tests.",
    severity: "low",
    attack_category: "suspicious_login",
    mitre_attack_techniques: [],
    target_type: "identity",
    simulated_events: [
      {
        kind: "monitoring.alert.synthetic",
        payload: { title: "Lab" },
      },
    ],
    expected_agent_sequence: [
      { id: "s1", agent_key: "scanner", capability: "correlate_stub" },
    ],
    expected_controls_triggered: [],
    expected_remediation: { summary: "None" },
    expected_report_sections: [],
    pass_fail_rules: {
      agent_sequence_order_required: false,
      all_report_sections_required: false,
      require_all_agent_steps: false,
    },
    ...over,
  } as ScenarioDefinition;
}

describe("failureInjector", () => {
  it("resolveSimulationTargetAgentId maps agent_1 alias", () => {
    expect(resolveSimulationTargetAgentId("agent_1")).toBe(AGENT_1_ID);
  });

  it("applyDuplicateEventInjection prepends a duplicate of the first stamped event", () => {
    const ev = [
      {
        id: "evt-1-a",
        scenarioId: "failure-inj-fixture",
        runId: "run-x",
        kind: "monitoring.alert.synthetic" as const,
        simulatedAt: "2026-01-01T00:00:00.000Z",
        payload: {},
      },
    ];
    const scenario = baseScenario({
      failure_injection: { enabled: true, type: "duplicate_event" },
    });
    const out = applyDuplicateEventInjection(scenario, ev);
    expect(out.length).toBe(2);
    expect(out[1]?.id).toBe("evt-1-a-duplicate-injection");
    expect(out[0]?.id).toBe("evt-1-a");
  });

  it("mergeFailureInjectionIntoSimulationResult flips aggregation-controls for policy_validation_failure", () => {
    const scenario = baseScenario({
      failure_injection: { enabled: true, type: "policy_validation_failure" },
    });
    const seed = {
      runId: "r",
      scenarioId: scenario.id,
      passed: true,
      validations: [
        {
          expectationId: "s1",
          passed: true,
          detail: "ok",
        },
        {
          expectationId: "aggregation-controls",
          passed: true,
          detail: "controls ok",
        },
      ],
      summary: "seed",
      finishedAt: new Date().toISOString(),
    };
    const merged = mergeFailureInjectionIntoSimulationResult(scenario, seed);
    expect(merged.passed).toBe(false);
    const ctrl = merged.validations.find((v) => v.expectationId === "aggregation-controls");
    expect(ctrl?.passed).toBe(false);
  });

  it("injectAgentValidatorFailures marks target agent failed for malformed_agent_response", () => {
    const scenario = baseScenario({
      failure_injection: {
        enabled: true,
        type: "malformed_agent_response",
        target_agent: "agent_1",
      },
    });
    const row = injectAgentValidatorFailures(scenario, [
      {
        agentId: AGENT_1_ID,
        passed: true,
        score: 100,
        failures: [],
        warnings: [],
        evidence: {},
      },
    ]);
    expect(row[0]?.passed).toBe(false);
    expect(row[0]?.failures.some((f) => /malformed/i.test(f))).toBe(true);
  });

  it("shouldSimulateDatabaseInsertFailure only for supabase/inngest modes at configured index", () => {
    const scenario = baseScenario({
      failure_injection: {
        enabled: true,
        type: "database_failure",
        event_index: 1,
      },
    });
    expect(shouldSimulateDatabaseInsertFailure(scenario, "local", 0)).toBe(false);
    expect(shouldSimulateDatabaseInsertFailure(scenario, "supabase", 0)).toBe(false);
    expect(shouldSimulateDatabaseInsertFailure(scenario, "supabase", 1)).toBe(true);
  });
});
