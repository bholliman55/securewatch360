/**
 * Attack Simulation & Autonomy Test Lab — public facade.
 * Synthetic events only — see simulator/README.md.
 */

export type {
  Scenario,
  ScenarioAssurance,
  SimulatedEvent,
  SimulatedEventKind,
  SimulatedEventTemplate,
  ExpectedAgentAction,
  SimulationRun,
  SimulationEnvironmentLabel,
  SimulationResult,
  ValidationResult,
} from "./types";

export type {
  OrchestrationEventSink,
  SimulationEngine,
  SimulationMode,
  EmitCorrelation,
  CollectedSignals,
  RunScenarioOptions,
} from "./engines";
export type { AgentResponseValidator } from "./validators";
export type { SimulationLabReport } from "./reports";

export { minimalSyntheticFindingScenario } from "./fixtures/minimalSyntheticFinding.fixture";

export {
  scenarioDefinitionSchema,
  simulationResultSchema,
  parseScenarioDefinition,
  safeParseScenarioDefinition,
  parseSimulationResult,
  safeParseSimulationResult,
  type ScenarioDefinition,
  type SimulationResultDocument,
  type AttackCategory,
} from "./schema";

export {
  emitSimulatedEvent,
  emitSimulatedEvents,
  resolveSimulationMode,
  getSupabaseProjectUrlFromEnv,
  requireSimulationTenantId,
  simulatedEventToMonitoringPayload,
  observeAgentSignals,
  evaluateScenarioExpectations,
  persistSimulationArtifacts,
  defaultScenariosDirectory,
  loadScenarioDefinitionsFromDirectory,
  loadScenarioDefinitionFile,
  stampSimulatedEvents,
  executeScenarioSimulation,
  executeAllScenarioSimulations,
  buildStructuredSimulationReport,
} from "./engines";
