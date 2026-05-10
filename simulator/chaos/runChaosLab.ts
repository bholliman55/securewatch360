/**
 * Orchestrates a chaos lab run: schedule → inject → metrics → resilience score.
 */

import { randomUUID } from "node:crypto";
import { parseSimulationScenarioDocument } from "../schema";
import type { SimulatedEvent } from "../types";
import { stampSimulatedEvents } from "../engines/simulationRunner";
import { applyChaosInjection } from "./chaosInjector";
import { emptyChaosMetrics, mergeSideEffectsIntoMetrics } from "./chaosMetrics";
import { computeResilienceScore } from "./resilienceScore";
import { buildChaosSchedule } from "./chaosScheduler";
import type { ChaosScheduleOptions } from "./chaosTypes";

export type ChaosLabReport = {
  lab_run_id: string;
  started_at: string;
  completed_at: string;
  schedule_options: ChaosScheduleOptions;
  ticks: {
    tickIndex: number;
    kind: string;
    label: string;
    events_in: number;
    events_out: number;
    delay_ms: number;
    side_effect_tags: string[];
  }[];
  metrics: ReturnType<typeof emptyChaosMetrics>;
  resilience: ReturnType<typeof computeResilienceScore>;
};

function minimalChaosScenario() {
  return parseSimulationScenarioDocument({
    id: "chaos-lab-harness",
    name: "Chaos Lab Harness",
    description: "Synthetic minimal scenario for chaos scheduling only.",
    severity: "low",
    attack_category: "suspicious_login",
    mitre_attack_techniques: [],
    target_type: "service",
    simulated_events: [
      {
        kind: "monitoring.alert.synthetic",
        payload: { title: "Chaos harness alert", severity: "medium" },
      },
      {
        kind: "finding.synthetic",
        payload: { title: "Chaos harness finding", cvss: 5.0 },
      },
    ],
    expected_agent_sequence: [{ id: "h1", agent_key: "scanner", capability: "stub" }],
    expected_controls_triggered: [],
    expected_remediation: { summary: "Lab-only" },
    expected_report_sections: [],
    pass_fail_rules: {
      agent_sequence_order_required: false,
      all_report_sections_required: false,
      require_all_agent_steps: false,
    },
  });
}

/**
 * Run the chaos lab against a minimal stamped event stream (no live orchestration required).
 */
export async function runChaosLab(options?: ChaosScheduleOptions): Promise<ChaosLabReport> {
  const labRunId = randomUUID();
  const startedAt = new Date().toISOString();
  const scenario = minimalChaosScenario();
  const baseStamped = stampSimulatedEvents(scenario, labRunId);

  const schedule = buildChaosSchedule(options);
  let metrics = emptyChaosMetrics();
  const tickRows: ChaosLabReport["ticks"] = [];

  for (const plan of schedule) {
    const eventsIn = baseStamped.length;
    const injected = await applyChaosInjection({
      kind: plan.kind,
      events: baseStamped,
      tickIndex: plan.tickIndex,
    });

    metrics = mergeSideEffectsIntoMetrics(
      metrics,
      plan.kind,
      eventsIn,
      injected.events.length,
      injected.sideEffects,
      injected.delayMsApplied,
    );

    tickRows.push({
      tickIndex: plan.tickIndex,
      kind: plan.kind,
      label: plan.label,
      events_in: eventsIn,
      events_out: injected.events.length,
      delay_ms: injected.delayMsApplied,
      side_effect_tags: injected.sideEffects.map((s) => s.tag),
    });
  }

  const completedAt = new Date().toISOString();
  const resilience = computeResilienceScore(metrics);

  return {
    lab_run_id: labRunId,
    started_at: startedAt,
    completed_at: completedAt,
    schedule_options: options ?? {},
    ticks: tickRows,
    metrics,
    resilience,
  };
}

/** Optional: apply chaos to an arbitrary stamped stream (advanced integrations). */
export async function runChaosTicksOnEvents(
  stamped: SimulatedEvent[],
  options?: ChaosScheduleOptions,
): Promise<ChaosLabReport> {
  const labRunId = randomUUID();
  const startedAt = new Date().toISOString();
  const schedule = buildChaosSchedule(options);
  let metrics = emptyChaosMetrics();
  const tickRows: ChaosLabReport["ticks"] = [];

  for (const plan of schedule) {
    const eventsIn = stamped.length;
    const injected = await applyChaosInjection({
      kind: plan.kind,
      events: stamped,
      tickIndex: plan.tickIndex,
    });

    metrics = mergeSideEffectsIntoMetrics(
      metrics,
      plan.kind,
      eventsIn,
      injected.events.length,
      injected.sideEffects,
      injected.delayMsApplied,
    );

    tickRows.push({
      tickIndex: plan.tickIndex,
      kind: plan.kind,
      label: plan.label,
      events_in: eventsIn,
      events_out: injected.events.length,
      delay_ms: injected.delayMsApplied,
      side_effect_tags: injected.sideEffects.map((s) => s.tag),
    });
  }

  return {
    lab_run_id: labRunId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    schedule_options: options ?? {},
    ticks: tickRows,
    metrics,
    resilience: computeResilienceScore(metrics),
  };
}
