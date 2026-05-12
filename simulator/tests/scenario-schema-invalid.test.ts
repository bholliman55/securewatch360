import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  scenarioDefinitionSchema,
  parseSimulationScenarioDocument,
  safeParseSimulationScenarioDocument,
  attackPlaybookSchema,
} from "../schema";

describe("Scenario schema validation (negative paths)", () => {
  it("rejects invalid MITRE technique ids", () => {
    const bad = {
      id: "bad-mitre",
      name: "Bad",
      description: "x",
      severity: "low",
      attack_category: "phishing",
      mitre_attack_techniques: ["T99999"], // digits must match TNNNN(.NNN)?
      target_type: "x",
      simulated_events: [{ kind: "finding.synthetic", payload: {} }],
      expected_agent_sequence: [
        { id: "s1", agent_key: "a", capability: "c", match: {} },
      ],
      expected_controls_triggered: [],
      expected_remediation: { summary: "s" },
      expected_report_sections: ["executive_summary"],
      pass_fail_rules: {
        agent_sequence_order_required: false,
        all_report_sections_required: false,
      },
    };

    expect(scenarioDefinitionSchema.safeParse(bad).success).toBe(false);
  });

  it("parseSimulationScenarioDocument throws on unrecognized document layout", () => {
    expect(() =>
      parseSimulationScenarioDocument({
        hello: "world",
      }),
    ).toThrow();
    const safe = safeParseSimulationScenarioDocument({ hello: "world" });
    expect(safe.success).toBe(false);
  });

  it("rejects safe_synthetic playbook when events_emitted is empty", () => {
    const scenariosDir = path.join(__dirname, "../scenarios");
    const raw = JSON.parse(
      fs.readFileSync(path.join(scenariosDir, "pb-01-phishing-email-clicked.json"), "utf8"),
    );
    const broken = { ...raw, events_emitted: [] };

    expect(attackPlaybookSchema.safeParse(broken).success).toBe(false);
  });
});
