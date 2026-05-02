/**
 * Shared pass/fail aggregation for scenario validations (no I/O).
 * Kept separate from resultCollector to avoid import cycles with failure injection.
 */

import type { ScenarioDefinition } from "../schema";
import type { ValidationResult } from "../types";

export function aggregateSimulationPassFromValidations(
  scenario: ScenarioDefinition,
  validations: ValidationResult[],
): boolean {
  const agentOnly = validations.filter((v) =>
    scenario.expected_agent_sequence.some((s) => s.id === v.expectationId),
  );

  const requireAgents = scenario.pass_fail_rules.require_all_agent_steps === true;
  let passed = requireAgents ? agentOnly.every((v) => v.passed) : agentOnly.some((v) => v.passed);

  const orderGate = validations.find((v) => v.expectationId === "rule-order-check");
  if (orderGate && !orderGate.passed) passed = false;

  const controls = validations.find((v) => v.expectationId === "aggregation-controls");
  if (controls && !controls.passed) passed = false;

  return passed;
}
