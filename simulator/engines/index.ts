export type { OrchestrationEventSink } from "./orchestration-sink";
export type { SimulationEngine } from "./simulation-engine";

export type { SimulationMode, EmitCorrelation } from "./eventEmitter";
export {
  resolveSimulationMode,
  getSupabaseProjectUrlFromEnv,
  requireServiceRoleKey,
  requireSimulationTenantId,
  simulatedEventToMonitoringPayload,
  emitSimulatedEvent,
  emitSimulatedEvents,
} from "./eventEmitter";

export type { CollectedSignals, SimulationAuditRow } from "../engineSignals.types";
export type { StoredSimulationArtifacts } from "./resultCollector";
export {
  parseWaitEnv,
  observeAgentSignals,
  evaluateScenarioExpectations,
  persistSimulationArtifacts,
  __setResultCollectorMockClient,
} from "./resultCollector";

export type { EmitSimulatedEventOptions } from "./eventEmitter";
export type { FailureInjectionType, FailureInjection } from "../schema";
export {
  resolveSimulationTargetAgentId,
  mergeFailureInjectionIntoSimulationResult,
  injectAgentValidatorFailures,
  applyDuplicateEventInjection,
  failureInjectionTelemetry,
} from "./failureInjector";
export { aggregateSimulationPassFromValidations } from "./simulationOutcome";

export type { RunScenarioOptions } from "./simulationRunner";
export {
  defaultScenariosDirectory,
  loadScenarioDefinitionsFromDirectory,
  loadScenarioDefinitionFile,
  stampSimulatedEvents,
  executeScenarioSimulation,
  executeAllScenarioSimulations,
  buildStructuredSimulationReport,
} from "./simulationRunner";
