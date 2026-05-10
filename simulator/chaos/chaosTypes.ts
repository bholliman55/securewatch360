/**
 * Chaos engineering catalog for SecureWatch360 simulator lab runs.
 * Synthetic stress signals only — no production fault injection.
 */

export const CHAOS_SCENARIO_KINDS = [
  "delayed_agent_response",
  "dropped_events",
  "duplicate_events",
  "malformed_payloads",
  "supabase_outage",
  "inngest_outage",
  "agent_crash",
  "partial_remediation",
  "timeout_loops",
  "corrupted_reports",
  "memory_pressure",
  "rate_limiting",
] as const;

export type ChaosScenarioKind = (typeof CHAOS_SCENARIO_KINDS)[number];

export type ChaosTickPlan = {
  tickIndex: number;
  kind: ChaosScenarioKind;
  /** Deterministic label for logs */
  label: string;
};

export type ChaosScheduleOptions = {
  /** Total simulation ticks (fault injections). Default: length of full catalog. */
  ticks?: number;
  /** RNG seed for repeatable schedules when ordering is shuffled. */
  seed?: number;
  /** When true, shuffle catalog order before cycling (deterministic from seed). */
  shuffle?: boolean;
};

export type ChaosSideEffectTag =
  | "delay_applied"
  | "events_dropped"
  | "events_duplicated"
  | "payload_malformed"
  | "supabase_outage_simulated"
  | "inngest_outage_simulated"
  | "agent_crash_simulated"
  | "partial_remediation_simulated"
  | "timeout_loop_simulated"
  | "report_corruption_simulated"
  | "memory_pressure_simulated"
  | "rate_limit_simulated"
  | "recovery_hint_emitted";

export type ChaosSideEffect = {
  tag: ChaosSideEffectTag;
  detail?: string;
  numeric?: number;
};
