import type { Scenario } from "../types";

/** Example scenario: single synthetic finding envelope for pipeline smoke tests */
export const minimalSyntheticFindingScenario: Scenario = {
  id: "lab-find-001",
  name: "Minimal synthetic finding (metadata only)",
  description:
    "Emits one structured finding-shaped event with placeholder fields. Safe for staging — no payloads that scan or authenticate.",
  tags: ["smoke", "finding"],
  assurance: "synthetic_metadata_only",
  eventTemplates: [
    {
      kind: "finding.synthetic",
      payload: {
        title: "LAB: Synthetic CVE-style title (fixture)",
        severity: "medium",
        category: "lab_simulation",
        assetType: "hostname",
        targetValue: "lab-target.example.invalid",
      },
      metadata: { simulator: true },
    },
  ],
  expectations: [
    {
      id: "exp-decision-ingested",
      agentKey: "decision-engine",
      capability: "evaluation_record_written",
      match: {
        severity: "medium",
      },
    },
  ],
};
