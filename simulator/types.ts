/**
 * SecureWatch360 Attack Simulation & Autonomy Test Lab — core types.
 * All simulated data is synthetic metadata only (no exploits, payloads, or live attacks).
 */

/** Declarative test scenario: ordered synthetic events plus expected autonomous responses. */
export interface Scenario {
  id: string;
  name: string;
  /** Human-readable scope; never includes instructions to execute real attacks. */
  description: string;
  tags?: string[];
  /** Scenarios MUST use synthetic payloads only — see README assurance model. */
  assurance: ScenarioAssurance;
  /** Template events before `scenarioId` is stamped at runtime. */
  eventTemplates: SimulatedEventTemplate[];
  expectations: ExpectedAgentAction[];
}

export type ScenarioAssurance =
  | "synthetic_metadata_only"
  | "fixture_replay"
  | "mock_orchestration";

/** Event shape emitted by the simulator into the orchestration/event layer (no weaponized content). */
export interface SimulatedEvent {
  id: string;
  scenarioId: string;
  runId: string;
  kind: SimulatedEventKind;
  simulatedAt: string;
  tenantId?: string;
  /** Deterministic fixture-style payload — e.g. finding fields, alert envelope, correlation ids. */
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type SimulatedEventKind =
  | "finding.synthetic"
  | "monitoring.alert.synthetic"
  | "external_intel.synthetic"
  | "remediation.execution.synthetic"
  | "custom.synthetic";

export interface SimulatedEventTemplate {
  kind: SimulatedEventKind;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** What SecureWatch360 (agent / workflow) should do — used by validators after the run. */
export interface ExpectedAgentAction {
  id: string;
  /** Logical agent identifier, aligned with internal workflow names where applicable. */
  agentKey: string;
  /** Named capability — e.g. evidence_written, playbook_generated, escalation_emitted */
  capability: string;
  /** Declarative match hints for validators (field paths, enums, thresholds). */
  match: Record<string, unknown>;
}

/** One execution of a scenario against orchestration backends (dev/staging mocks). */
export interface SimulationRun {
  id: string;
  scenarioId: string;
  startedAt: string;
  completedAt?: string;
  environment: SimulationEnvironmentLabel;
  events: SimulatedEvent[];
  orchestrationCorrelationIds?: string[];
}

export type SimulationEnvironmentLabel = "local" | "ci" | "staging" | string;

/** Aggregated outcome for auditors and CI gates. */
export interface SimulationResult {
  runId: string;
  scenarioId: string;
  passed: boolean;
  validations: ValidationResult[];
  /** Short narrative for dashboards / SAR-style summaries. */
  summary: string;
  finishedAt: string;
}

/** Per-expectation verdict from validators. */
export interface ValidationResult {
  expectationId: string;
  passed: boolean;
  detail: string;
  observed?: Record<string, unknown>;
}
