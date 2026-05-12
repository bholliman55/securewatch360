/**
 * Aggregates chaos lab observations into counters for dashboards and resilience scoring.
 */

import type { ChaosScenarioKind } from "./chaosTypes";
import type { ChaosSideEffect } from "./chaosTypes";

export type ChaosMetrics = {
  ticks_total: number;
  kinds_executed: ChaosScenarioKind[];
  events_in: number;
  events_out: number;
  events_dropped: number;
  events_duplicated: number;
  delays_ms_total: number;
  malformed_payloads: number;
  supabase_outage_ticks: number;
  inngest_outage_ticks: number;
  agent_crash_ticks: number;
  partial_remediation_ticks: number;
  timeout_loop_ticks: number;
  corrupted_report_ticks: number;
  memory_pressure_ticks: number;
  rate_limit_ticks: number;
  recovery_hints_emitted: number;
};

export function emptyChaosMetrics(): ChaosMetrics {
  return {
    ticks_total: 0,
    kinds_executed: [],
    events_in: 0,
    events_out: 0,
    events_dropped: 0,
    events_duplicated: 0,
    delays_ms_total: 0,
    malformed_payloads: 0,
    supabase_outage_ticks: 0,
    inngest_outage_ticks: 0,
    agent_crash_ticks: 0,
    partial_remediation_ticks: 0,
    timeout_loop_ticks: 0,
    corrupted_report_ticks: 0,
    memory_pressure_ticks: 0,
    rate_limit_ticks: 0,
    recovery_hints_emitted: 0,
  };
}

export function mergeSideEffectsIntoMetrics(
  metrics: ChaosMetrics,
  kind: ChaosScenarioKind,
  eventsIn: number,
  eventsOut: number,
  effects: ChaosSideEffect[],
  delayMs: number,
): ChaosMetrics {
  const next = { ...metrics };
  next.ticks_total += 1;
  next.kinds_executed = [...next.kinds_executed, kind];
  next.events_in += eventsIn;
  next.events_out += eventsOut;

  if (delayMs > 0) next.delays_ms_total += delayMs;

  for (const e of effects) {
    switch (e.tag) {
      case "delay_applied":
        break;
      case "events_dropped":
        next.events_dropped += e.numeric ?? 0;
        break;
      case "events_duplicated":
        next.events_duplicated += e.numeric ?? 1;
        break;
      case "payload_malformed":
        next.malformed_payloads += 1;
        break;
      case "supabase_outage_simulated":
        next.supabase_outage_ticks += 1;
        break;
      case "inngest_outage_simulated":
        next.inngest_outage_ticks += 1;
        break;
      case "agent_crash_simulated":
        next.agent_crash_ticks += 1;
        break;
      case "partial_remediation_simulated":
        next.partial_remediation_ticks += 1;
        break;
      case "timeout_loop_simulated":
        next.timeout_loop_ticks += 1;
        break;
      case "report_corruption_simulated":
        next.corrupted_report_ticks += 1;
        break;
      case "memory_pressure_simulated":
        next.memory_pressure_ticks += 1;
        break;
      case "rate_limit_simulated":
        next.rate_limit_ticks += 1;
        break;
      case "recovery_hint_emitted":
        next.recovery_hints_emitted += 1;
        break;
      default:
        break;
    }
  }

  return next;
}
