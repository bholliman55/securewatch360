import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { coerceOrchestrationModeForSimulationDemo } from "../fixtures/demoMode";
import {
  loadScenarioDefinitionsFromDirectory,
  executeScenarioSimulation,
} from "../engines/simulationRunner";

describe("simulation demo mode", () => {
  let prevWait: string | undefined;

  beforeAll(() => {
    prevWait = process.env.SIMULATION_AGENT_WAIT_MS;
    process.env.SIMULATION_AGENT_WAIT_MS = "0";
  });

  afterAll(() => {
    if (prevWait !== undefined) process.env.SIMULATION_AGENT_WAIT_MS = prevWait;
    else delete process.env.SIMULATION_AGENT_WAIT_MS;
  });

  it("coerces any requested orchestration sink to local rehearsal", () => {
    expect(coerceOrchestrationModeForSimulationDemo("local")).toBe("local");
    expect(coerceOrchestrationModeForSimulationDemo("supabase")).toBe("local");
    expect(coerceOrchestrationModeForSimulationDemo("inngest")).toBe("local");
  });

  it("runs with fictitious fixtures, blocks live sinks, and stamps dashboard_summary", async () => {
    const prevDemo = process.env.SIMULATION_DEMO_MODE;
    delete process.env.SIMULATION_DEMO_MODE;

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-sim-demo-"));
    const humanTmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-sim-demo-human-"));
    try {
      const defs = await loadScenarioDefinitionsFromDirectory(path.join(__dirname, "../scenarios"));
      const scenario = defs.find((d) => d.id === "lab-phish-001");
      expect(scenario).toBeDefined();

      const report = await executeScenarioSimulation(scenario!, {
        simulationDemoMode: true,
        mode: "supabase",
        persistenceBaseDir: tmp,
        reportOutputDir: humanTmp,
      });

      expect(report.run.environment).toBe("demo-local");
      expect(report.run.simulation_demo_mode).toBe(true);
      expect(report.run.demo_client_snapshot?.display_name).toBeTruthy();

      expect(report.dashboardSummary.simulation_demo_mode).toBe(true);
      expect(report.dashboardSummary.demo_disclaimer?.length ?? 0).toBeGreaterThan(10);

      expect(report.dashboardSummary.remediationStatus).toContain("live remediation execution blocked");

      const structured = JSON.parse(await fs.readFile(report.persisted!.reportPath!, "utf8"));
      expect(structured.dashboard_summary?.simulation_demo_mode).toBe(true);

      const jr = JSON.parse(await fs.readFile(report.persisted!.humanReportJsonPath!, "utf8"));
      expect(jr.simulation_demo_mode).toBe(true);
      expect(typeof jr.demo_truthfulness_statement === "string").toBe(true);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
      await fs.rm(humanTmp, { recursive: true, force: true }).catch(() => undefined);
      if (prevDemo !== undefined) process.env.SIMULATION_DEMO_MODE = prevDemo;
    }
  });
});
