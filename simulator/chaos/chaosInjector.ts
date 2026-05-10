/**
 * Chaos injector — applies synthetic fault transforms to stamped simulator events.
 * Used only inside the simulator lab; does not touch live Supabase/Inngest APIs.
 */

import type { SimulatedEvent } from "../types";
import type { ChaosScenarioKind, ChaosSideEffect } from "./chaosTypes";

function shouldSkipWallClockDelay(): boolean {
  const v = process.env.CHAOS_LAB_SKIP_DELAY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type ChaosInjectionResult = {
  events: SimulatedEvent[];
  sideEffects: ChaosSideEffect[];
  /** Wall-clock delay applied (for delayed_agent_response). */
  delayMsApplied: number;
};

function cloneEvent(ev: SimulatedEvent): SimulatedEvent {
  return {
    ...ev,
    payload: { ...ev.payload },
    metadata: ev.metadata ? { ...ev.metadata } : undefined,
  };
}

/**
 * Apply one chaos scenario transform to a stamped event list.
 */
export async function applyChaosInjection(args: {
  kind: ChaosScenarioKind;
  events: SimulatedEvent[];
  tickIndex: number;
}): Promise<ChaosInjectionResult> {
  const { kind, tickIndex } = args;
  let events = args.events.map(cloneEvent);
  const sideEffects: ChaosSideEffect[] = [];
  let delayMsApplied = 0;

  if (events.length === 0) {
    return { events, sideEffects, delayMsApplied };
  }

  switch (kind) {
    case "delayed_agent_response": {
      delayMsApplied = shouldSkipWallClockDelay() ? 0 : Math.min(150 + tickIndex * 25, 800);
      if (delayMsApplied > 0) {
        await new Promise((r) => setTimeout(r, delayMsApplied));
      }
      sideEffects.push({ tag: "delay_applied", numeric: delayMsApplied });
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_delayed_agent_response_ms: delayMsApplied,
              },
            }
          : e,
      );
      break;
    }
    case "dropped_events": {
      const dropCount = Math.max(1, Math.floor(events.length / 2));
      events = events.slice(dropCount);
      sideEffects.push({
        tag: "events_dropped",
        detail: `dropped_${dropCount}_of_${args.events.length}`,
        numeric: dropCount,
      });
      break;
    }
    case "duplicate_events": {
      const first = events[0]!;
      const dup: SimulatedEvent = {
        ...cloneEvent(first),
        id: `${first.id}-chaos-dup-${tickIndex}`,
        simulatedAt: new Date().toISOString(),
        metadata: {
          ...(first.metadata ?? {}),
          chaos_duplicate_event: true,
        },
      };
      events = [first, dup, ...events.slice(1)];
      sideEffects.push({ tag: "events_duplicated", numeric: 1 });
      break;
    }
    case "malformed_payloads": {
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              payload: {
                ...e.payload,
                chaos_malformed: true,
                chaos_truncated_json: '{"broken"',
              },
            }
          : e,
      );
      sideEffects.push({ tag: "payload_malformed" });
      break;
    }
    case "supabase_outage": {
      sideEffects.push({ tag: "supabase_outage_simulated" });
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_sink_unavailable: "supabase",
                chaos_recovery_hint: "retry_with_exponential_backoff",
              },
            }
          : e,
      );
      sideEffects.push({ tag: "recovery_hint_emitted" });
      break;
    }
    case "inngest_outage": {
      sideEffects.push({ tag: "inngest_outage_simulated" });
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_sink_unavailable: "inngest",
                chaos_recovery_hint: "queue_locally_until_restored",
              },
            }
          : e,
      );
      sideEffects.push({ tag: "recovery_hint_emitted" });
      break;
    }
    case "agent_crash": {
      events = events.map((e, i) =>
        i === events.length - 1
          ? {
              ...e,
              payload: {},
              metadata: {
                ...(e.metadata ?? {}),
                chaos_agent_crash: true,
                chaos_exit_code: -1,
              },
            }
          : e,
      );
      sideEffects.push({ tag: "agent_crash_simulated" });
      sideEffects.push({ tag: "recovery_hint_emitted", detail: "restart_agent_slice" });
      break;
    }
    case "partial_remediation": {
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_partial_remediation: true,
                chaos_remediation_percent: 42,
              },
            }
          : e,
      );
      sideEffects.push({ tag: "partial_remediation_simulated", numeric: 42 });
      break;
    }
    case "timeout_loops": {
      const iterations = 3 + (tickIndex % 4);
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_timeout_loop_iterations: iterations,
                chaos_deadline_exceeded: true,
              },
            }
          : e,
      );
      sideEffects.push({ tag: "timeout_loop_simulated", numeric: iterations });
      sideEffects.push({ tag: "recovery_hint_emitted", detail: "circuit_break_after_n_retries" });
      break;
    }
    case "corrupted_reports": {
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_report_checksum_mismatch: true,
                chaos_corrupted_section: "summary",
              },
            }
          : e,
      );
      sideEffects.push({ tag: "report_corruption_simulated" });
      break;
    }
    case "memory_pressure": {
      const simulatedBytes = 256_000 + tickIndex * 1024;
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_memory_pressure_simulated_bytes: simulatedBytes,
                chaos_gc_pressure_level: "elevated",
              },
            }
          : e,
      );
      sideEffects.push({ tag: "memory_pressure_simulated", numeric: simulatedBytes });
      break;
    }
    case "rate_limiting": {
      events = events.map((e, i) =>
        i === 0
          ? {
              ...e,
              metadata: {
                ...(e.metadata ?? {}),
                chaos_rate_limit_simulated: true,
                chaos_retry_after_ms: 500,
              },
            }
          : e,
      );
      sideEffects.push({ tag: "rate_limit_simulated", numeric: 500 });
      sideEffects.push({ tag: "recovery_hint_emitted", detail: "respect_retry_after" });
      break;
    }
  }

  return { events, sideEffects, delayMsApplied };
}
