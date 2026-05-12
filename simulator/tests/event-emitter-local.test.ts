import { describe, it, expect, vi, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { emitSimulatedEvent, resolveSimulationMode } from "../engines/eventEmitter";
import { loadScenarioDefinitionFile } from "../engines/simulationRunner";
import type { SimulatedEvent } from "../types";

describe("Event emitter — local adapter", () => {
  const prevMode = process.env.SIMULATION_MODE;

  afterEach(() => {
    if (prevMode !== undefined) process.env.SIMULATION_MODE = prevMode;
    else delete process.env.SIMULATION_MODE;
    vi.restoreAllMocks();
  });

  it("resolveSimulationMode defaults to local when unset", () => {
    delete process.env.SIMULATION_MODE;
    expect(resolveSimulationMode()).toBe("local");
    expect(resolveSimulationMode("LOCAL")).toBe("local");
  });

  it("emitSimulatedEvent(local) logs phased lines and returns mode-only envelope", async () => {
    process.env.SIMULATION_MODE = "local";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const scenario = await loadScenarioDefinitionFile(
      path.join(__dirname, "fixtures/mock-minimal-local.json"),
    );

    const event: SimulatedEvent = {
      id: `evt-test-local-1`,
      scenarioId: scenario.id,
      runId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      kind: scenario.simulated_events[0]!.kind,
      simulatedAt: new Date().toISOString(),
      payload: { ...scenario.simulated_events[0]!.payload },
    };

    const corr = await emitSimulatedEvent(scenario, event, "local");

    expect(corr.mode).toBe("local");
    expect(corr.auditLogId).toBeUndefined();
    expect(corr.ingest).toBeUndefined();
    expect(spy).toHaveBeenCalled();

    const lines = spy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('"phase":"emit_start"'))).toBe(true);
    expect(lines.some((l) => l.includes('"phase":"emit_complete"'))).toBe(true);

    spy.mockRestore();
  });
});
