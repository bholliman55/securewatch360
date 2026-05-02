import type { SimulationResult, SimulationRun, Scenario } from "../types";

/** Serializable lab report for CI artifacts and dashboards. */
export interface SimulationLabReport {
  generatedAt: string;
  simulatorVersion?: string;
  scenario: Pick<Scenario, "id" | "name">;
  run: Pick<
    SimulationRun,
    "id" | "startedAt" | "completedAt" | "environment" | "simulation_demo_mode" | "demo_client_snapshot"
  >;
  result: SimulationResult;
}
