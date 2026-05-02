import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadScenarioDefinitionsFromDirectory,
  executeScenarioSimulation,
} from "../engines/simulationRunner";

describe("Simulation runner (local sink)", () => {
  let prevWait: string | undefined;

  beforeAll(() => {
    prevWait = process.env.SIMULATION_AGENT_WAIT_MS;
    process.env.SIMULATION_AGENT_WAIT_MS = "0";
    process.env.SIMULATION_MODE = "local";
  });

  afterAll(() => {
    if (prevWait !== undefined) process.env.SIMULATION_AGENT_WAIT_MS = prevWait;
    else delete process.env.SIMULATION_AGENT_WAIT_MS;
  });

  it("loads bundled scenarios directory", async () => {
    const dir = path.join(__dirname, "../scenarios");
    const defs = await loadScenarioDefinitionsFromDirectory(dir);
    expect(defs.length).toBeGreaterThanOrEqual(3);
  });

  it("persists artifact JSON for minimal local execution", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-sim-"));
    const humanTmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-sim-human-"));
    const defs = await loadScenarioDefinitionsFromDirectory(path.join(__dirname, "../scenarios"));
    const scenario = defs.find((d) => d.id === "lab-phish-001");
    expect(scenario).toBeDefined();

    const report = await executeScenarioSimulation(scenario!, {
      mode: "local",
      persistenceBaseDir: tmp,
      reportOutputDir: humanTmp,
    });

    expect(report.run.environment).toBe("local");

    expect(report.result.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(report.persisted?.resultPath).toBeDefined();
    expect(report.persisted?.reportPath).toBeDefined();

    const stat = await fs.stat(report.persisted!.resultPath!);
    expect(stat.isFile()).toBe(true);

    expect(report.persisted?.humanReportJsonPath).toBeDefined();
    expect(report.persisted?.humanReportMarkdownPath).toBeDefined();
    expect(report.dashboardSummary.runId).toBe(report.result.runId);
    expect(report.dashboardSummary.scenarioName).toBeTruthy();

    const structured = JSON.parse(await fs.readFile(report.persisted!.reportPath!, "utf8"));
    expect(structured.dashboard_summary?.runId).toBe(report.result.runId);

    const jr = JSON.parse(await fs.readFile(report.persisted!.humanReportJsonPath!, "utf8"));
    expect(jr.scenario_name).toBeTruthy();
    expect(jr.timeline.length).toBeGreaterThanOrEqual(1);

    await fs.rm(tmp, { recursive: true, force: true });
    await fs.rm(humanTmp, { recursive: true, force: true });
  });
});
