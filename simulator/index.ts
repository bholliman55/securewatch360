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
export type {
  AgentResponseValidator,
  AgentValidatorContext,
  AgentValidatorResult,
} from "./validators";
export type {
  SimulationLabReport,
  SimulationDashboardSummary,
  SimulationDashboardSummaryStatus,
  SimulationDashboardTimelineEvent,
} from "./reports";
export { buildSimulationDashboardSummary, deriveDashboardSummaryStatus } from "./reports";

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

export {
  AGENT_1_ID,
  AGENT_2_ID,
  AGENT_3_ID,
  AGENT_4_ID,
  AGENT_5_ID,
  runAllSecureWatchAgentValidators,
  validateAgent1Response,
  validateAgent2Response,
  validateAgent3Response,
  validateAgent4Response,
  validateAgent5Response,
} from "./validators";
