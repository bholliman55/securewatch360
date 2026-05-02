import path from "node:path";
import { describe, it, expect } from "vitest";
import type { ScenarioDefinition } from "../schema";
import type { SimulatedEvent } from "../types";
import type { CollectedSignals } from "../engineSignals.types";
import { loadScenarioDefinitionsFromDirectory } from "../engines/simulationRunner";
import {
  AGENT_1_ID,
  validateAgent1Response,
  AGENT_2_ID,
  validateAgent2Response,
  AGENT_3_ID,
  validateAgent3Response,
  AGENT_4_ID,
  validateAgent4Response,
  AGENT_5_ID,
  validateAgent5Response,
  runAllSecureWatchAgentValidators,
} from "../validators";

describe("SecureWatch agent validators", () => {
  const emptySignals: CollectedSignals = {
    observationWindowStartIso: new Date().toISOString(),
    observationWindowEndIso: new Date().toISOString(),
    pollIterations: 0,
    auditRowsForRun: [],
    auditRowsNearTimeline: [],
  };

  async function phishingScenario(): Promise<ScenarioDefinition> {
    const dir = path.join(__dirname, "../scenarios");
    const defs = await loadScenarioDefinitionsFromDirectory(dir);
    return defs.find((d) => d.id === "lab-phish-001")!;
  }

  function stampSynthetic(scenario: ScenarioDefinition): SimulatedEvent[] {
    return scenario.simulated_events.map((tpl, idx) => ({
      id: `evt-test-${scenario.id}-${idx}`,
      scenarioId: scenario.id,
      runId: "00000000-0000-0000-0000-00000000ab12",
      kind: tpl.kind,
      simulatedAt: new Date().toISOString(),
      payload: { ...tpl.payload },
      ...(tpl.metadata !== undefined ? { metadata: tpl.metadata } : {}),
    }));
  }

  it("returns standardized shapes", async () => {
    const scenario = await phishingScenario();
    const ctx = {
      scenario,
      runId: "00000000-0000-0000-0000-00000000ab12",
      signals: emptySignals,
      stampedEvents: stampSynthetic(scenario),
    };

    const r4 = validateAgent4Response(ctx);
    expect(r4.agentId).toBe(AGENT_4_ID);
    expect(r4).toHaveProperty("passed");
    expect(r4).toHaveProperty("score");
    expect(Array.isArray(r4.failures)).toBe(true);
    expect(Array.isArray(r4.warnings)).toBe(true);
    expect(typeof r4.evidence).toBe("object");

    const all = runAllSecureWatchAgentValidators(ctx);
    expect(all).toHaveLength(5);
    expect(new Set(all.map((a) => a.agentId))).toEqual(
      new Set([AGENT_1_ID, AGENT_2_ID, AGENT_3_ID, AGENT_4_ID, AGENT_5_ID]),
    );
  });

  it("aggregates suite for ransomware scenario (Agent 5 heavy)", async () => {
    const dir = path.join(__dirname, "../scenarios");
    const defs = await loadScenarioDefinitionsFromDirectory(dir);
    const scenario = defs.find((d) => d.id === "lab-ransom-002")!;
    const ctx = {
      scenario,
      runId: "00000000-0000-0000-0000-00000000cd34",
      signals: emptySignals,
      stampedEvents: stampSynthetic(scenario),
    };
    const a5 = validateAgent5Response(ctx);
    expect(a5.agentId).toBe(AGENT_5_ID);
    expect(a5.score).toBeGreaterThanOrEqual(0);
  });
});
