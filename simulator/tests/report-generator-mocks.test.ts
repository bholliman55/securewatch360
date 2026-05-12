import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { loadScenarioDefinitionFile } from "../engines/simulationRunner";
import { buildSimulationRunHumanReport, writeSimulationRunReports } from "../reports/reportGenerator";
import type { SimulationResult } from "../types";
import type { AutonomyScorecard } from "../reports/autonomyScorecard";
import { MOCK_AGENT_RESULTS_ALL_PASS } from "./fixtures/mockAgentValidatorResults";

describe("Report generation with mock agents and autonomy snapshot", () => {
  it("buildSimulationRunHumanReport embeds autonomy and agent mock rows", async () => {
    const scenario = await loadScenarioDefinitionFile(
      path.join(__dirname, "fixtures/mock-minimal-local.json"),
    );
    const autonomy: AutonomyScorecard = {
      detection_success_rate: 0.75,
      agent_trigger_accuracy: 0.8,
      remediation_success_rate: 0.7,
      policy_enforcement_success_rate: 0.85,
      false_positive_risk: 0.15,
      false_negative_risk: 0.18,
      human_intervention_required: 0.3,
      time_to_detect_seconds: 12,
      time_to_triage_seconds: 90,
      time_to_remediate_seconds: 200,
      report_quality_score: 70,
      overall_autonomy_score: 77,
      readiness_band: "strong_needs_fixes",
    };

    const result: SimulationResult = {
      runId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
      scenarioId: scenario.id,
      passed: true,
      validations: [
        { expectationId: "mock-step-1", passed: true, detail: "ok", observed: {} },
        { expectationId: "aggregation-controls", passed: true, detail: "ok", observed: {} },
      ],
      summary: "mock",
      finishedAt: "2026-05-03T10:06:00.000Z",
    };

    const doc = buildSimulationRunHumanReport({
      scenario,
      result,
      run: {
        id: result.runId,
        scenarioId: scenario.id,
        startedAt: "2026-05-03T10:00:00.500Z",
        completedAt: "2026-05-03T10:05:50.000Z",
        environment: "test",
        events: [],
      },
      signals: {
        observationWindowStartIso: "2026-05-03T10:00:00.000Z",
        observationWindowEndIso: "2026-05-03T10:05:00.000Z",
        pollIterations: 0,
        auditRowsForRun: [],
        auditRowsNearTimeline: [],
      },
      emissions: [{ mode: "local" }],
      autonomyScorecard: autonomy,
      securewatchAgents: MOCK_AGENT_RESULTS_ALL_PASS,
    });

    expect(doc.autonomy_score.overall_autonomy_score).toBe(77);
    expect(doc.agents_triggered.map((a) => a.agent_id).sort()).toEqual(
      MOCK_AGENT_RESULTS_ALL_PASS.map((a) => a.agentId).sort(),
    );
    expect(doc.meta.report_kind).toBe("securewatch360_simulation_run");
  });

  it("writeSimulationRunReports persists JSON+MD when using mock payloads", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-rpt-mock-"));
    const scenario = await loadScenarioDefinitionFile(
      path.join(__dirname, "fixtures/mock-minimal-local.json"),
    );
    const autonomy: AutonomyScorecard = {
      detection_success_rate: 0.9,
      agent_trigger_accuracy: 0.9,
      remediation_success_rate: 0.9,
      policy_enforcement_success_rate: 0.9,
      false_positive_risk: 0.05,
      false_negative_risk: 0.05,
      human_intervention_required: 0.1,
      time_to_detect_seconds: 1,
      time_to_triage_seconds: 30,
      time_to_remediate_seconds: 60,
      report_quality_score: 90,
      overall_autonomy_score: 92,
      readiness_band: "production_ready",
    };
    const runId = "cccccccc-dddd-eeee-ffff-000011112222";
    const result: SimulationResult = {
      runId,
      scenarioId: scenario.id,
      passed: true,
      validations: [
        { expectationId: "mock-step-1", passed: true, detail: "ok", observed: {} },
        { expectationId: "aggregation-controls", passed: true, detail: "ok", observed: {} },
      ],
      summary: "mock",
      finishedAt: "2026-05-03T10:06:00.000Z",
    };

    const out = await writeSimulationRunReports({
      scenario,
      result,
      run: {
        id: runId,
        scenarioId: scenario.id,
        startedAt: "2026-05-03T10:00:00.000Z",
        completedAt: "2026-05-03T10:05:00.000Z",
        environment: "test",
        events: [],
      },
      signals: {
        observationWindowStartIso: "2026-05-03T10:00:00.000Z",
        observationWindowEndIso: "2026-05-03T10:05:00.000Z",
        pollIterations: 0,
        auditRowsForRun: [],
        auditRowsNearTimeline: [],
      },
      emissions: [],
      autonomyScorecard: autonomy,
      securewatchAgents: MOCK_AGENT_RESULTS_ALL_PASS,
      outputDirectory: tmp,
    });

    const raw = JSON.parse(await fs.readFile(out.jsonPath, "utf8"));
    expect(raw.pass_fail_status).toBe("PASS");
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
