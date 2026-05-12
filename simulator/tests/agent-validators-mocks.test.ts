import path from "node:path";
import { describe, it, expect } from "vitest";
import type { CollectedSignals } from "../engineSignals.types";
import { loadScenarioDefinitionsFromDirectory } from "../engines/simulationRunner";
import {
  runAllSecureWatchAgentValidators,
  AGENT_1_ID,
  AGENT_2_ID,
  AGENT_3_ID,
  AGENT_4_ID,
  AGENT_5_ID,
} from "../validators";
import type { SimulatedEvent } from "../types";
import type { ScenarioDefinition } from "../schema";
import { MOCK_AGENT_RESULTS_ALL_PASS } from "./fixtures/mockAgentValidatorResults";

describe("Agent validators with mock response inventory", () => {
  const signals: CollectedSignals = {
    observationWindowStartIso: new Date().toISOString(),
    observationWindowEndIso: new Date().toISOString(),
    pollIterations: 0,
    auditRowsForRun: [],
    auditRowsNearTimeline: [],
  };

  function stampScenario(scenario: ScenarioDefinition, runId: string): SimulatedEvent[] {
    return scenario.simulated_events.map((tpl, idx) => ({
      id: `evt-${runId}-${idx}`,
      scenarioId: scenario.id,
      runId,
      kind: tpl.kind,
      simulatedAt: new Date().toISOString(),
      payload: { ...tpl.payload },
      ...(tpl.metadata !== undefined ? { metadata: tpl.metadata } : {}),
    }));
  }

  it("MOCK_AGENT_RESULTS_ALL_PASS covers canonical five agent ids", () => {
    const ids = MOCK_AGENT_RESULTS_ALL_PASS.map((r) => r.agentId).sort();
    expect(ids).toEqual(
      [AGENT_1_ID, AGENT_2_ID, AGENT_3_ID, AGENT_4_ID, AGENT_5_ID].sort(),
    );
  });

  it("runAllSecureWatchAgentValidators returns five rows for mock-minimal scenario context", async () => {
    const dir = path.join(__dirname, "fixtures");
    const defs = await loadScenarioDefinitionsFromDirectory(dir);
    const scenario = defs.find((d) => d.id === "mock-lab-min-local-001")!;
    const runId = "00000000-0000-0000-0000-0000000099aa";
    const all = runAllSecureWatchAgentValidators({
      scenario,
      runId,
      signals,
      stampedEvents: stampScenario(scenario, runId),
    });
    expect(all).toHaveLength(5);
    expect(all.every((r) => typeof r.score === "number")).toBe(true);
  });
});
