import type { AgentValidatorContext, AgentValidatorResult } from "./agentValidatorShared";
import { validateAgent1Response, AGENT_1_ID, isAgent1ScenarioLikely } from "./agent1.validator";
import { validateAgent2Response, AGENT_2_ID, isAgent2ScenarioLikely } from "./agent2.validator";
import { validateAgent3Response, AGENT_3_ID, isAgent3ScenarioLikely } from "./agent3.validator";
import { validateAgent4Response, AGENT_4_ID, isAgent4ScenarioLikely } from "./agent4.validator";
import { validateAgent5Response, AGENT_5_ID, isAgent5ScenarioLikely } from "./agent5.validator";

export type { AgentResponseValidator } from "./agent-response-validator";

export type { AgentValidatorContext, AgentValidatorResult, CheckItem } from "./agentValidatorShared";
export {
  auditHaystackFromSignals,
  eventsHaystack,
  scenarioSeverityNormalized,
  unsafeInstructionScan,
  collectExpectedStepsForAgents,
  buildAgentValidatorResult,
} from "./agentValidatorShared";

export {
  AGENT_1_ID,
  isAgent1ScenarioLikely,
  validateAgent1Response,
  AGENT_2_ID,
  isAgent2ScenarioLikely,
  validateAgent2Response,
  AGENT_3_ID,
  isAgent3ScenarioLikely,
  validateAgent3Response,
  AGENT_4_ID,
  isAgent4ScenarioLikely,
  validateAgent4Response,
  AGENT_5_ID,
  isAgent5ScenarioLikely,
  validateAgent5Response,
};

/** Executes all simulator-side SecureWatch canonical agent validations (Agents 1–5). */
export function runAllSecureWatchAgentValidators(ctx: AgentValidatorContext): AgentValidatorResult[] {
  return [
    validateAgent1Response(ctx),
    validateAgent2Response(ctx),
    validateAgent3Response(ctx),
    validateAgent4Response(ctx),
    validateAgent5Response(ctx),
  ];
}
