import type { Scenario, SimulationRun, SimulatedEvent } from "../types";

/**
 * Scenario driver: templates → stamped events → optional sink emission.
 */
export interface SimulationEngine {
  startRun(scenario: Scenario, options?: { tenantId?: string }): SimulationRun;

  emit(run: SimulationRun, events: SimulatedEvent[]): Promise<SimulationRun>;
}
