/**
 * Lab failure injection for the SecureWatch360 simulator.
 * Scenario JSON: optional `failure_injection: { enabled, type, target_agent?, delay_ms?, event_index? }`.
 */

import type { FailureInjection, ScenarioDefinition } from "../schema";
import type { SimulationResult, SimulatedEvent, ValidationResult } from "../types";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";
import {
  AGENT_1_ID,
  AGENT_2_ID,
  AGENT_3_ID,
  AGENT_4_ID,
  AGENT_5_ID,
} from "../validators";
import type { SimulationMode } from "./eventEmitter";
import { aggregateSimulationPassFromValidations } from "./simulationOutcome";

export type { FailureInjectionType, FailureInjection } from "../schema";

const AGENT_ALIAS: Record<string, string> = {
  agent_1: AGENT_1_ID,
  agent1: AGENT_1_ID,
  "1": AGENT_1_ID,
  agent_2: AGENT_2_ID,
  agent2: AGENT_2_ID,
  "2": AGENT_2_ID,
  agent_3: AGENT_3_ID,
  agent3: AGENT_3_ID,
  "3": AGENT_3_ID,
  agent_4: AGENT_4_ID,
  agent4: AGENT_4_ID,
  "4": AGENT_4_ID,
  agent_5: AGENT_5_ID,
  agent5: AGENT_5_ID,
  "5": AGENT_5_ID,
};

export function resolveSimulationTargetAgentId(target?: string): string | undefined {
  if (!target?.trim()) return undefined;
  const raw = target.trim();
  const key = raw.toLowerCase().replace(/-/g, "_");
  if (AGENT_ALIAS[key]) return AGENT_ALIAS[key];
  if (raw.startsWith("agent-")) return raw;
  return raw;
}

export function getFailureInjectionEventIndex(fi: FailureInjection | undefined): number {
  return fi?.event_index ?? 0;
}

function activeInjection(scenario: ScenarioDefinition): FailureInjection | undefined {
  const fi = scenario.failure_injection;
  if (!fi?.enabled) return undefined;
  return fi;
}

export function shouldSimulateDatabaseInsertFailure(
  scenario: ScenarioDefinition,
  mode: SimulationMode,
  sequenceIndex: number,
): boolean {
  const fi = activeInjection(scenario);
  if (!fi || fi.type !== "database_failure") return false;
  if (mode === "local") return false;
  return sequenceIndex === getFailureInjectionEventIndex(fi);
}

export function shouldSimulateInngestSendFailure(
  scenario: ScenarioDefinition,
  mode: SimulationMode,
  sequenceIndex: number,
): boolean {
  const fi = activeInjection(scenario);
  if (!fi || fi.type !== "inngest_failure") return false;
  if (mode !== "inngest") return false;
  return sequenceIndex === getFailureInjectionEventIndex(fi);
}

export async function observeDelayForFailureInjection(scenario: ScenarioDefinition): Promise<void> {
  const fi = activeInjection(scenario);
  if (!fi || fi.type !== "agent_late_response") return;
  const ms = fi.delay_ms ?? 750;
  await new Promise((r) => setTimeout(r, ms));
}

export function applyDuplicateEventInjection(
  scenario: ScenarioDefinition,
  stamped: SimulatedEvent[],
): SimulatedEvent[] {
  const fi = activeInjection(scenario);
  if (!fi || fi.type !== "duplicate_event") return stamped;
  if (stamped.length < 1) return stamped;
  const first = stamped[0]!;
  const dup: SimulatedEvent = {
    ...first,
    id: `${first.id}-duplicate-injection`,
    simulatedAt: new Date().toISOString(),
    metadata: {
      ...(first.metadata ?? {}),
      simulator_duplicate_injection: true,
    },
  };
  return [first, dup, ...stamped.slice(1)];
}

function pickTargetAgentId(fi: FailureInjection): string {
  return resolveSimulationTargetAgentId(fi.target_agent) ?? AGENT_1_ID;
}

export function injectAgentValidatorFailures(
  scenario: ScenarioDefinition,
  agents: AgentValidatorResult[],
): AgentValidatorResult[] {
  const fi = activeInjection(scenario);
  if (!fi) return agents;

  const targetId = pickTargetAgentId(fi);

  const mutate = (row: AgentValidatorResult): AgentValidatorResult => {
    if (row.agentId !== targetId) return row;
    switch (fi.type) {
      case "agent_timeout":
        return {
          ...row,
          passed: false,
          score: Math.min(row.score, 20),
          failures: [
            ...row.failures,
            "failure_injection: agent timed out before producing a usable response.",
          ],
          evidence: { ...row.evidence, failure_injection: fi.type },
        };
      case "agent_no_response":
        return {
          ...row,
          passed: false,
          score: Math.min(row.score, 15),
          failures: [
            ...row.failures,
            "failure_injection: agent produced no observable response within the lab window.",
          ],
          evidence: { ...row.evidence, failure_injection: fi.type },
        };
      case "malformed_agent_response":
        return {
          ...row,
          passed: false,
          score: Math.min(row.score, 25),
          failures: [
            ...row.failures,
            "failure_injection: agent output failed structural validation (malformed).",
          ],
          evidence: { ...row.evidence, failure_injection: fi.type },
        };
      default:
        return row;
    }
  };

  return agents.map(mutate);
}

export function mergeFailureInjectionIntoSimulationResult(
  scenario: ScenarioDefinition,
  result: SimulationResult,
): SimulationResult {
  const fi = activeInjection(scenario);
  if (!fi) return result;

  const validations: ValidationResult[] = [...result.validations];

  switch (fi.type) {
    case "policy_validation_failure": {
      const idx = validations.findIndex((v) => v.expectationId === "aggregation-controls");
      if (idx >= 0) {
        const row = validations[idx]!;
        validations[idx] = {
          ...row,
          passed: false,
          detail: `${row.detail} [failure_injection: policy_validation_failure]`,
        };
      } else {
        validations.push({
          expectationId: "aggregation-controls",
          passed: false,
          detail: "Synthetic policy / controls gate failed (failure_injection).",
        });
      }
      break;
    }
    case "remediation_failure":
      validations.push({
        expectationId: "injection-remediation",
        passed: false,
        detail: "Synthetic remediation failure (failure_injection: remediation_failure).",
      });
      break;
    case "human_approval_missing":
      validations.push({
        expectationId: "injection-human-approval",
        passed: false,
        detail: "Human approval was required but no approval record was observed (failure_injection).",
      });
      break;
    default:
      break;
  }

  const passed = aggregateSimulationPassFromValidations(scenario, validations);
  return {
    ...result,
    passed,
    validations,
    summary: `${result.summary} | failure_injection=${fi.type}`,
  };
}

export function isReportGenerationFailureInjected(scenario: ScenarioDefinition): boolean {
  const fi = activeInjection(scenario);
  return fi?.type === "report_generation_failure";
}

export function failureInjectionTelemetry(
  scenario: ScenarioDefinition,
): Record<string, unknown> | undefined {
  const fi = scenario.failure_injection;
  if (!fi) return undefined;
  return {
    enabled: fi.enabled,
    type: fi.type,
    target_agent: fi.target_agent,
    delay_ms: fi.delay_ms,
    event_index: fi.event_index,
  };
}
