/**
 * Maps chaos metrics to a 0–100 resilience score for simulator lab reporting.
 * Higher is better — rewards recovery hints and stable event throughput under fault load.
 */

import type { ChaosMetrics } from "./chaosMetrics";

export type ResilienceScoreBreakdown = {
  score: number;
  base: number;
  deductions: { reason: string; points: number }[];
  bonuses: { reason: string; points: number }[];
};

/**
 * Compute resilience score from aggregated chaos run metrics.
 */
export function computeResilienceScore(metrics: ChaosMetrics): ResilienceScoreBreakdown {
  const deductions: ResilienceScoreBreakdown["deductions"] = [];
  const bonuses: ResilienceScoreBreakdown["bonuses"] = [];

  let score = 100;

  // Fault exposure (expected during chaos — moderate penalties)
  const dropPenalty = Math.min(28, metrics.events_dropped * 4);
  if (dropPenalty > 0) deductions.push({ reason: "events_dropped_under_fault_load", points: dropPenalty });
  score -= dropPenalty;

  const malformedPenalty = Math.min(18, metrics.malformed_payloads * 6);
  if (malformedPenalty > 0) deductions.push({ reason: "malformed_payload_ticks", points: malformedPenalty });
  score -= malformedPenalty;

  const outagePenalty = Math.min(
    22,
    (metrics.supabase_outage_ticks + metrics.inngest_outage_ticks) * 5,
  );
  if (outagePenalty > 0)
    deductions.push({ reason: "simulated_dependency_outages", points: outagePenalty });
  score -= outagePenalty;

  const crashPenalty = Math.min(20, metrics.agent_crash_ticks * 7);
  if (crashPenalty > 0) deductions.push({ reason: "simulated_agent_crashes", points: crashPenalty });
  score -= crashPenalty;

  const partialPenalty = Math.min(12, metrics.partial_remediation_ticks * 4);
  if (partialPenalty > 0)
    deductions.push({ reason: "partial_remediation_ticks", points: partialPenalty });
  score -= partialPenalty;

  const timeoutPenalty = Math.min(14, metrics.timeout_loop_ticks * 4);
  if (timeoutPenalty > 0) deductions.push({ reason: "timeout_loop_ticks", points: timeoutPenalty });
  score -= timeoutPenalty;

  const corruptPenalty = Math.min(12, metrics.corrupted_report_ticks * 6);
  if (corruptPenalty > 0)
    deductions.push({ reason: "corrupted_report_ticks", points: corruptPenalty });
  score -= corruptPenalty;

  const memPenalty = Math.min(10, metrics.memory_pressure_ticks * 3);
  if (memPenalty > 0) deductions.push({ reason: "memory_pressure_ticks", points: memPenalty });
  score -= memPenalty;

  const rlPenalty = Math.min(10, metrics.rate_limit_ticks * 3);
  if (rlPenalty > 0) deductions.push({ reason: "rate_limit_ticks", points: rlPenalty });
  score -= rlPenalty;

  // Positive signals: observability / recovery posture
  const recoveryBonus = Math.min(18, metrics.recovery_hints_emitted * 2);
  if (recoveryBonus > 0) bonuses.push({ reason: "recovery_hints_emitted", points: recoveryBonus });
  score += recoveryBonus;

  // Throughput steadiness: duplicates are stressful but events still flowed
  const dupBonus = Math.min(6, metrics.events_duplicated * 2);
  if (dupBonus > 0) bonuses.push({ reason: "dedup_eligible_event_flow", points: dupBonus });
  score += dupBonus;

  score = Math.round(Math.min(100, Math.max(0, score)));

  return {
    score,
    base: 100,
    deductions,
    bonuses,
  };
}
