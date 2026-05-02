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

export type { CollectedSignals, SimulationAuditRow, StoredSimulationArtifacts } from "./resultCollector";
export {
  parseWaitEnv,
  observeAgentSignals,
  evaluateScenarioExpectations,
  persistSimulationArtifacts,
  __setResultCollectorMockClient,
} from "./resultCollector";

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
