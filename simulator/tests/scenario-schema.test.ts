import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  scenarioDefinitionSchema,
  parseSimulationResult,
  simulationResultSchema,
} from "../schema";

const scenariosDir = path.join(__dirname, "../scenarios");

describe("scenarioDefinitionSchema", () => {
  it.each([
    "phishing_email_clicked.json",
    "ransomware_behavior_detected.json",
    "cmmc_policy_drift_detected.json",
  ])("parses fixture %s", (file) => {
    const raw = JSON.parse(fs.readFileSync(path.join(scenariosDir, file), "utf8"));
    const r = scenarioDefinitionSchema.safeParse(raw);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.format(), null, 2)).toBe(
      true,
    );
  });

  it("applies assurance default when omitted", () => {
    const minimal = {
      id: "lab-min-default",
      name: "Minimal",
      description: "Synthetic only.",
      severity: "low",
      attack_category: "suspicious_login",
      mitre_attack_techniques: [],
      target_type: "user_identity",
      simulated_events: [
        {
          kind: "monitoring.alert.synthetic",
          payload: { note: "lab" },
        },
      ],
      expected_agent_sequence: [
        {
          id: "a1",
          agent_key: "decision-engine",
          capability: "noop_stub",
        },
      ],
      expected_controls_triggered: [],
      expected_remediation: {
        summary: "None.",
      },
      expected_report_sections: ["executive_summary"],
      pass_fail_rules: {
        agent_sequence_order_required: false,
        all_report_sections_required: true,
      },
    };

    const out = scenarioDefinitionSchema.parse(minimal);
    expect(out.assurance).toBe("synthetic_metadata_only");
  });
});

describe("simulationResultSchema", () => {
  it("parses a plausible lab outcome document", () => {
    const doc = {
      run_id: "run-lab-7f3",
      scenario_id: "lab-phish-001",
      passed: true,
      validations: [
        {
          expectation_id: "seq-01",
          passed: true,
          detail: "Awareness stub fired",
          observed: { route: "/api/lab/awareness.stub" },
        },
      ],
      summary: "All synthetic expectations met.",
      finished_at: "2026-05-02T17:45:12.000Z",
    };

    expect(() => parseSimulationResult(doc)).not.toThrow();
    expect(simulationResultSchema.safeParse(doc).success).toBe(true);
  });
});
