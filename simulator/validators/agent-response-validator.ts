import type {
  ExpectedAgentAction,
  SimulationRun,
  ValidationResult,
} from "../types";

/** Compares persisted / captured agent outputs vs scenario expectations (symbolic assertions). */
export interface AgentResponseValidator {
  validate(run: SimulationRun, expectation: ExpectedAgentAction): Promise<ValidationResult>;
}
