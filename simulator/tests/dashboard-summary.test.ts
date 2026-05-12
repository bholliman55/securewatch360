import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSimulationDashboardSummary, deriveDashboardSummaryStatus } from "../reports/dashboardSummary";
import { computeAutonomyScorecard } from "../reports/autonomyScorecard";
import type { CollectedSignals } from "../engineSignals.types";
import type { SimulationResult, SimulationRun } from "../types";
import { loadScenarioDefinitionsFromDirectory } from "../engines/simulationRunner";
import { runAllSecureWatchAgentValidators } from "../validators";

const emptySignals: CollectedSignals = {
  observationWindowStartIso: new Date().toISOString(),
  observationWindowEndIso: new Date().toISOString(),
  pollIterations: 0,
  auditRowsForRun: [],
  auditRowsNearTimeline: [],
};

describe("buildSimulationDashboardSummary", () => {
  it("fills all UI contract fields for a local playbook run", async () => {
    const dir = path.join(__dirname, "../scenarios");
    const defs = await loadScenarioDefinitionsFromDirectory(dir);
    const scenario = defs.find((s) => s.id === "pb-lab-01-phishing-clicked");
    expect(scenario).toBeDefined();

    const runId = "00000000-0000-4000-8000-000000000099";
    const startedAt = "2026-05-03T12:00:00.000Z";
    const run: SimulationRun = {
      id: runId,
      scenarioId: scenario!.id,
      startedAt,
      completedAt: "2026-05-03T12:05:00.000Z",
      environment: "local",
      events: [
        {
          id: `evt-${runId}-a`,
          scenarioId: scenario!.id,
          runId,
          kind: "monitoring.alert.synthetic",
          simulatedAt: startedAt,
          payload: { title: "Lab alert" },
        },
      ],
    };

    const result: SimulationResult = {
      runId,
      scenarioId: scenario!.id,
      passed: true,
      validations: [
        { expectationId: "pb01-seq-01", passed: true, detail: "ok" },
        { expectationId: "aggregation-controls", passed: true, detail: "Matched approx 1/2" },
      ],
      summary: "ok",
      finishedAt: "2026-05-03T12:05:01.000Z",
    };

    const agents = runAllSecureWatchAgentValidators({
      scenario: scenario!,
      runId,
      signals: emptySignals,
      stampedEvents: run.events,
    });

    const autonomy = computeAutonomyScorecard({
      scenario: scenario!,
      result,
      run,
      signals: emptySignals,
      securewatchAgents: agents,
    });

    const summary = buildSimulationDashboardSummary({
      scenario: scenario!,
      run,
      result,
      autonomyScorecard: autonomy,
      securewatchAgents: agents,
      signals: emptySignals,
      emissions: [{ mode: "local" }],
      simulationMode: "local",
    });

    expect(summary.schema_version).toBe(1);
    expect(summary.runId).toBe(runId);
    expect(summary.scenarioName).toBeTruthy();
    expect(["passed", "failed", "partial"]).toContain(summary.status);
    expect(summary.autonomyScore).toBeGreaterThanOrEqual(0);
    expect(summary.autonomyScore).toBeLessThanOrEqual(100);
    expect(summary.agentsPassed + summary.agentsFailed).toBe(agents.length);
    expect(summary.remediationStatus.length).toBeGreaterThan(10);
    expect(summary.controlsValidated.length).toBeGreaterThan(5);
    expect(summary.timelineEvents.length).toBeGreaterThan(0);
    expect(summary.executiveSummary.length).toBeGreaterThan(10);
    expect(summary.technicalSummary).toContain("local");
    expect(summary.nextRecommendedAction.length).toBeGreaterThan(5);
  });

  it("deriveDashboardSummaryStatus marks failed when scenario expectations fail", () => {
    const agents = [{ agentId: "a", passed: true, score: 100, failures: [] as string[], warnings: [] as string[], evidence: {} }];
    const resultPass = { passed: true, validations: [] } as unknown as SimulationResult;
    const resultFail = { passed: false, validations: [] } as unknown as SimulationResult;
    expect(deriveDashboardSummaryStatus(resultPass, agents)).toBe("passed");
    expect(deriveDashboardSummaryStatus(resultFail, agents)).toBe("failed");
  });
});
