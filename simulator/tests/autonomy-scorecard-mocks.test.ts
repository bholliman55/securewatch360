import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadScenarioDefinitionFile } from "../engines/simulationRunner";
import { computeAutonomyScorecard } from "../reports/autonomyScorecard";
import type { SimulationResult } from "../types";
import { MOCK_AGENT_RESULTS_ALL_PASS, MOCK_AGENT_RESULTS_MIXED } from "./fixtures/mockAgentValidatorResults";
import type { CollectedSignals } from "../engineSignals.types";

describe("Autonomy score calculation with mock agent responses", () => {
  const signals: CollectedSignals = {
    observationWindowStartIso: "2026-05-03T10:00:00.000Z",
    observationWindowEndIso: "2026-05-03T10:04:00.000Z",
    pollIterations: 0,
    auditRowsForRun: [],
    auditRowsNearTimeline: [],
  };

  it("all-pass mock agents yield higher overall autonomy than mixed mock agents", async () => {
    const scenario = await loadScenarioDefinitionFile(
      path.join(__dirname, "fixtures/mock-minimal-local.json"),
    );
    const baseResult: SimulationResult = {
      runId: "aaaaaaaa-bbbb-cccc-dddd-eeeeaaaaaaaa",
      scenarioId: scenario.id,
      passed: true,
      validations: [
        {
          expectationId: "mock-step-1",
          passed: false,
          detail: "stub",
          observed: {},
        },
        {
          expectationId: "aggregation-controls",
          passed: true,
          detail: "controls ok",
          observed: {},
        },
      ],
      summary: "stub",
      finishedAt: "2026-05-03T10:05:00.000Z",
    };

    const good = computeAutonomyScorecard({
      scenario,
      result: { ...baseResult, passed: true },
      run: {
        id: baseResult.runId,
        startedAt: "2026-05-03T10:00:00.100Z",
        completedAt: "2026-05-03T10:04:59.000Z",
        events: [],
      },
      signals,
      securewatchAgents: MOCK_AGENT_RESULTS_ALL_PASS,
    });

    const worse = computeAutonomyScorecard({
      scenario,
      result: { ...baseResult, passed: true },
      run: {
        id: baseResult.runId,
        startedAt: "2026-05-03T10:00:00.100Z",
        completedAt: "2026-05-03T10:04:59.000Z",
        events: [],
      },
      signals,
      securewatchAgents: MOCK_AGENT_RESULTS_MIXED,
    });

    expect(good.overall_autonomy_score).toBeGreaterThan(worse.overall_autonomy_score);
    expect(good.agent_trigger_accuracy).toBeGreaterThanOrEqual(0.95);
  });
});
