import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScenarioDefinition } from "../schema";
import type { SimulationResult } from "../types";
import type { CollectedSignals } from "../engineSignals.types";
import type { EmitCorrelation } from "../engines/eventEmitter";
import type { AutonomyScorecard } from "../reports/autonomyScorecard";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";
import {
  buildSimulationRunHumanReport,
  renderSimulationRunReportMarkdown,
  writeSimulationRunReports,
} from "../reports/reportGenerator";

const scenario: ScenarioDefinition = {
  id: "report-gen-sample",
  name: "Sample | scenario",
  description: "Report generator unit sample.",
  assurance: "synthetic_metadata_only",
  severity: "medium",
  attack_category: "phishing",
  mitre_attack_techniques: ["T1566"],
  target_type: "user_identity",
  simulated_events: [
    { kind: "monitoring.alert.synthetic", payload: { alert_type: "lab", severity: "medium" } },
  ],
  expected_agent_sequence: [
    {
      id: "s1",
      agent_key: "decision-engine",
      capability: "evaluation_record_written",
      match: {},
    },
  ],
  expected_controls_triggered: [
    { framework: "nist_csf", control_id: "PR.AT-1", control_label: "Awareness" },
  ],
  expected_remediation: { summary: "Notify user stub.", human_in_the_loop: true },
  expected_report_sections: ["executive_summary"],
  pass_fail_rules: {
    agent_sequence_order_required: false,
    all_report_sections_required: false,
  },
};

const signals: CollectedSignals = {
  observationWindowStartIso: "2026-05-02T18:00:00.000Z",
  observationWindowEndIso: "2026-05-02T18:05:00.000Z",
  pollIterations: 0,
  auditRowsForRun: [],
  auditRowsNearTimeline: [],
};

describe("reportGenerator", () => {
  it("buildSimulationRunHumanReport includes required SAR-style sections", () => {
    const result: SimulationResult = {
      runId: "550e8400-e29b-41d4-a716-446655440000",
      scenarioId: scenario.id,
      passed: true,
      validations: [
        {
          expectationId: "s1",
          passed: true,
          detail: "Matched",
          observed: {},
        },
        {
          expectationId: "aggregation-controls",
          passed: true,
          detail: "ok",
          observed: {},
        },
      ],
      summary: "[sim:z] PASS",
      finishedAt: "2026-05-02T18:06:00.000Z",
    };

    const run = {
      id: result.runId,
      scenarioId: scenario.id,
      startedAt: "2026-05-02T18:00:00.010Z",
      completedAt: "2026-05-02T18:05:55.010Z",
      environment: "local",
      events: [
        {
          id: `evt-${result.runId}-0`,
          scenarioId: scenario.id,
          runId: result.runId,
          kind: "monitoring.alert.synthetic" as const,
          simulatedAt: "2026-05-02T18:01:02.010Z",
          payload: { alert_type: "lab" },
        },
      ],
    };

    const card: AutonomyScorecard = {
      detection_success_rate: 0.91,
      agent_trigger_accuracy: 0.92,
      remediation_success_rate: 0.8,
      policy_enforcement_success_rate: 0.85,
      false_positive_risk: 0.1,
      false_negative_risk: 0.12,
      human_intervention_required: 0.4,
      time_to_detect_seconds: 62,
      time_to_triage_seconds: 238,
      time_to_remediate_seconds: null,
      report_quality_score: 72,
      overall_autonomy_score: 82,
      readiness_band: "strong_needs_fixes",
    };

    const agents: AgentValidatorResult[] = [
      {
        agentId: "agent-5-monitoring-incident-response",
        passed: true,
        score: 88,
        failures: [],
        warnings: ["fixture warning"],
        evidence: {},
      },
    ];

    const emissions: EmitCorrelation[] = [{ mode: "local" }];

    const doc = buildSimulationRunHumanReport({
      scenario,
      run,
      result,
      signals,
      emissions,
      autonomyScorecard: card,
      securewatchAgents: agents,
      generatedAtIso: "2026-05-02T18:07:00.000Z",
    });

    expect(doc.simulation_run_id).toBe(run.id);
    expect(doc.scenario_name).toContain("Sample");
    expect(doc.timeline.length).toBeGreaterThanOrEqual(1);
    expect(doc.agents_triggered.some((a) => a.agent_id.includes("monitoring"))).toBe(true);
    expect(doc.expected_vs_actual_actions[0]?.expected_agent_key).toBe("decision-engine");
    expect(doc.remediation_results.expected_summary).toContain("Notify");
    expect(doc.policy_controls_tested.some((c) => c.control_id === "PR.AT-1")).toBe(true);
    expect(doc.pass_fail_status).toBe("PASS");
    expect(doc.autonomy_score.overall_autonomy_score).toBe(82);
    expect(doc.critical_failures.length).toBe(0);

    const md = renderSimulationRunReportMarkdown(doc);
    expect(md).toContain("Simulation run report");
    expect(md).toContain("`550e8400-e29b-41d4-a716-446655440000`");
    expect(md).toContain("Autonomy score");
    expect(md).toContain("Critical failures");
  });

  it("writeSimulationRunReports writes JSON and Markdown files", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-report-"));

    const result: SimulationResult = {
      runId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      scenarioId: scenario.id,
      passed: false,
      validations: [
        { expectationId: "s1", passed: false, detail: "miss", observed: {} },
        { expectationId: "aggregation-controls", passed: true, detail: "ok", observed: {} },
      ],
      summary: "[sim:y] FAIL",
      finishedAt: "2026-05-02T18:06:00.000Z",
    };

    const run = {
      id: result.runId,
      scenarioId: scenario.id,
      startedAt: "2026-05-02T18:00:00.010Z",
      completedAt: "2026-05-02T18:05:55.010Z",
      environment: "local",
      events: [],
    };

    const card: AutonomyScorecard = {
      detection_success_rate: 0.4,
      agent_trigger_accuracy: 0.5,
      remediation_success_rate: 0.4,
      policy_enforcement_success_rate: 0.5,
      false_positive_risk: 0.3,
      false_negative_risk: 0.5,
      human_intervention_required: 0.55,
      time_to_detect_seconds: null,
      time_to_triage_seconds: 300,
      time_to_remediate_seconds: null,
      report_quality_score: 55,
      overall_autonomy_score: 52,
      readiness_band: "not_ready",
    };

    const out = await writeSimulationRunReports({
      scenario,
      run,
      result,
      signals,
      emissions: [],
      autonomyScorecard: card,
      securewatchAgents: [
        {
          agentId: "agent-5-monitoring-incident-response",
          passed: false,
          score: 40,
          failures: ["checklist item failed"],
          warnings: [],
          evidence: {},
        },
      ],
      outputDirectory: tmp,
    });

    const jsonRaw = JSON.parse(await fs.readFile(out.jsonPath, "utf8"));
    expect(jsonRaw.pass_fail_status).toBe("FAIL");
    expect(jsonRaw.recommended_fixes.length).toBeGreaterThanOrEqual(1);

    const md = await fs.readFile(out.markdownPath, "utf8");
    expect(md).toContain("FAIL");
    expect(md).toContain("Recommended fixes");

    await fs.rm(tmp, { recursive: true, force: true });
  });
});
