/**
 * Runtime schema for SecureWatch360 simulator scenario definitions (JSON / fixtures).
 * Synthetic metadata only — structures describe lab events, not executable attacks.
 */

import { z } from "zod";

/** Example attack categories used in lab scenarios (extensible via pull request). */
export const attackCategorySchema = z.enum([
  "phishing",
  "ransomware_behavior",
  "suspicious_login",
  "exposed_service",
  "vulnerable_dependency",
  "compliance_drift",
  "privilege_escalation_signal",
  "data_exfiltration_signal",
  "misconfigured_cloud_resource",
  "endpoint_compromise_signal",
]);

export type AttackCategory = z.infer<typeof attackCategorySchema>;

export const scenarioSeveritySchema = z.enum([
  "informational",
  "low",
  "medium",
  "high",
  "critical",
]);

export type ScenarioSeverity = z.infer<typeof scenarioSeveritySchema>;

/** MITRE ATT&CK technique id, e.g. T1566 or T1566.001 */
export const mitreTechniqueIdSchema = z
  .string()
  .regex(/^T\d{4}(\.\d{3})?$/, "Expected MITRE technique id like T1566 or T1566.001");

export const simulatedEventKindSchema = z.enum([
  "finding.synthetic",
  "monitoring.alert.synthetic",
  "external_intel.synthetic",
  "remediation.execution.synthetic",
  "custom.synthetic",
]);

export type SimulatedEventKindSchema = z.infer<typeof simulatedEventKindSchema>;

export const simulatedEventDefinitionSchema = z
  .object({
    /** Optional stable id for ordering / correlation in lab reports */
    ref: z.string().min(1).optional(),
    kind: simulatedEventKindSchema,
    /** Deterministic fixture payload only (no weaponized content). */
    payload: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const expectedAgentStepSchema = z
  .object({
    id: z.string().min(1),
    agent_key: z.string().min(1),
    capability: z.string().min(1),
    match: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const expectedControlRefSchema = z
  .object({
    framework: z.string().min(1),
    control_id: z.string().min(1).optional(),
    control_label: z.string().min(1).optional(),
  })
  .strict();

export const expectedRemediationSchema = z
  .object({
    summary: z.string().min(1),
    expected_action_types: z.array(z.string().min(1)).optional(),
    human_in_the_loop: z.boolean().optional(),
  })
  .strict();

export const passFailRulesSchema = z
  .object({
    /** If true, validators require expected_agent_sequence order to match observed sequence. */
    agent_sequence_order_required: z.boolean(),
    /** If true, every expected_report_sections entry must be present in output. */
    all_report_sections_required: z.boolean(),
    /** Minimum number of expected_controls_triggered that must map to observed evidence. */
    min_controls_matched: z.number().int().nonnegative().optional(),
    /** If true, every step in expected_agent_sequence must produce a passing validation row. */
    require_all_agent_steps: z.boolean().optional(),
  })
  .strict();

/**
 * Full scenario document (e.g. JSON fixture under `simulator/fixtures/samples/`).
 * Field names use snake_case to match compliance-style exports and static analysis tools.
 */
export const scenarioDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    severity: scenarioSeveritySchema,
    attack_category: attackCategorySchema,
    mitre_attack_techniques: z.array(mitreTechniqueIdSchema).default([]),
    target_type: z.string().min(1),
    simulated_events: z.array(simulatedEventDefinitionSchema).min(1),
    expected_agent_sequence: z.array(expectedAgentStepSchema).min(1),
    expected_controls_triggered: z.array(expectedControlRefSchema),
    expected_remediation: expectedRemediationSchema,
    expected_report_sections: z.array(z.string().min(1)),
    pass_fail_rules: passFailRulesSchema,
    /** Lab safety marker — must remain synthetic metadata only. */
    assurance: z
      .enum(["synthetic_metadata_only", "fixture_replay", "mock_orchestration"])
      .default("synthetic_metadata_only"),
    tags: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>;

export function parseScenarioDefinition(data: unknown): ScenarioDefinition {
  return scenarioDefinitionSchema.parse(data);
}

export function safeParseScenarioDefinition(data: unknown) {
  return scenarioDefinitionSchema.safeParse(data);
}

/** Canonical SecureWatch simulator agent IDs referenced in lab playbooks (align with `validators/agent*.validator.ts`). */
export const securewatchLabAgentIds = [
  "agent-1-scanner-external-recon",
  "agent-2-osint-vuln-intel",
  "agent-3-compliance-policy",
  "agent-4-awareness-phishing-training",
  "agent-5-monitoring-incident-response",
] as const;

export const playbookAgentIdSchema = z.enum(securewatchLabAgentIds);

export type PlaybookLabAgentId = z.infer<typeof playbookAgentIdSchema>;

/** Ordered synthetic timeline — narration only (no exploits or credentials). */
export const simulatedTimelineStepSchema = z
  .object({
    t_offset_seconds: z.number().nonnegative(),
    phase: z.string().min(1),
    synthetic_narrative: z.string().min(1),
  })
  .strict();

/** Human-readable mirror of simulated machine events (`simulated_events`) for playbook readers. */
export const eventsEmittedNarrativeEntrySchema = z
  .object({
    /** Optional join key to simulated_events[].ref */
    ref: z.string().min(1).optional(),
    headline: z.string().min(1),
    synthetic_detail: z.string().min(1),
  })
  .strict();

export const expectedAgentsTriggeredEntrySchema = z
  .object({
    agent_id: playbookAgentIdSchema,
    triggered_reason_synthetic: z.string().min(1),
  })
  .strict();

export const expectedAutonomousRemediationEntrySchema = z
  .object({
    synthetic_action: z.string().min(1),
    automation_boundary: z.enum([
      "lab_stub_only",
      "conditional_operator_confirm",
      "recommended_automation_simulation",
    ]),
  })
  .strict();

export const expectedHumanApprovalGateEntrySchema = z
  .object({
    gate: z.string().min(1),
    synthetic_rationale: z.string().min(1),
  })
  .strict();

export const expectedFinalReportEnvelopeSchema = z
  .object({
    title: z.string().min(1),
    synthetic_executive_summary: z.string().min(1),
    sections: z.array(z.string().min(1)).min(1),
  })
  .strict();

/** Safe synthetic “real-world style” playbook: extends base scenarios with timelines and outcome expectations (no payloads). */
export const attackPlaybookSchema = scenarioDefinitionSchema.extend({
  playbook_kind: z.literal("safe_synthetic_lab"),
  simulated_timeline: z.array(simulatedTimelineStepSchema).min(1),
  events_emitted: z.array(eventsEmittedNarrativeEntrySchema).min(1),
  expected_agents_triggered: z.array(expectedAgentsTriggeredEntrySchema).min(1),
  expected_autonomous_remediation: z.array(expectedAutonomousRemediationEntrySchema).min(1),
  expected_human_approval_gates: z.array(expectedHumanApprovalGateEntrySchema),
  expected_final_report: expectedFinalReportEnvelopeSchema,
});

export type AttackPlaybookDefinition = z.infer<typeof attackPlaybookSchema>;

export function parseAttackPlaybookDefinition(data: unknown): AttackPlaybookDefinition {
  return attackPlaybookSchema.parse(data);
}

export function safeParseAttackPlaybookDefinition(data: unknown) {
  return attackPlaybookSchema.safeParse(data);
}

/** Accepts legacy scenario JSON or playbook JSON (superset fields). */
export function parseSimulationScenarioDocument(data: unknown): ScenarioDefinition {
  const playbook = attackPlaybookSchema.safeParse(data);
  if (playbook.success) return playbook.data as ScenarioDefinition;
  const legacy = scenarioDefinitionSchema.safeParse(data);
  if (legacy.success) return legacy.data;
  throw new Error(
    `[scenario-document] Invalid JSON:\n${JSON.stringify(
      { playbook_issues: playbook.error.format(), legacy_issues: legacy.error.format() },
      null,
      2,
    )}`,
  );
}

export function safeParseSimulationScenarioDocument(data: unknown) {
  const playbook = attackPlaybookSchema.safeParse(data);
  if (playbook.success) return { success: true as const, data: playbook.data as ScenarioDefinition };
  const legacy = scenarioDefinitionSchema.safeParse(data);
  if (legacy.success) return { success: true as const, data: legacy.data };
  return {
    success: false as const,
    error: { playbook: playbook.error.format(), legacy: legacy.error.format() },
  };
}
