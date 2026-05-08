/**
 * `GET /api/demo/status` service handler.
 *
 * Returns the high-level state the operator/UI cares about most:
 *   - scenario status (`unseeded` / `ready` / `running` / `completed` / `archived`)
 *   - replay handle status (state + speed + emitted count, if any)
 *   - the most-recently-emitted event (or null before the first emission)
 *   - quick rollup of emitted vs total events
 *   - all metrics in display order
 *
 * This intentionally does NOT include the full timeline — that's
 * `/api/demo/events`. Keeping `/status` small lets the UI poll it
 * cheaply.
 */

import {
  INVESTOR_DEMO_SCENARIO,
  type DemoEventRow,
  type DemoMetricRow,
  type DemoScenarioRow,
} from "@/demo/investorMode";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getReplayStatus } from "@/server/demo/investorReplayStore";

import type { DemoServiceDeps, StatusResult } from "./types";

export async function handleStatus(
  deps: DemoServiceDeps = {},
): Promise<StatusResult> {
  const supabase = deps.supabase ?? getSupabaseAdminClient();
  const scenarioKey = INVESTOR_DEMO_SCENARIO.scenario_key;
  const errors: string[] = [];

  const [scenarioRow, events, metrics] = await Promise.all([
    safeSelectOne<DemoScenarioRow>(supabase, "demo_scenarios", scenarioKey, errors),
    safeSelectMany<DemoEventRow>(supabase, "demo_events", scenarioKey, errors, {
      column: "event_order",
      ascending: true,
    }),
    safeSelectMany<DemoMetricRow>(supabase, "demo_metrics", scenarioKey, errors, {
      column: "sort_order",
      ascending: true,
    }),
  ]);

  const emitted = events.filter((e) => e.status === "emitted");
  const currentEvent = emitted[emitted.length - 1] ?? null;

  const replay = deps.replayStore?.getReplayStatus() ?? getReplayStatus();

  return {
    ok: errors.length === 0,
    scenarioKey,
    scenarioStatus: scenarioRow?.status ?? "unseeded",
    replay,
    currentEvent,
    emittedCount: emitted.length,
    totalCount: events.length,
    metrics,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function safeSelectOne<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  scenarioKey: string,
  errors: string[],
): Promise<T | null> {
  try {
    const res = await supabase
      .from(table)
      .select("*")
      .eq("scenario_key", scenarioKey)
      .maybeSingle();
    if (res.error) {
      errors.push(`${table}: ${res.error.message}`);
      return null;
    }
    return (res.data as T | null) ?? null;
  } catch (err) {
    errors.push(
      `${table}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function safeSelectMany<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  scenarioKey: string,
  errors: string[],
  order: { column: string; ascending: boolean },
): Promise<T[]> {
  try {
    const res = await supabase
      .from(table)
      .select("*")
      .eq("scenario_key", scenarioKey)
      .order(order.column, { ascending: order.ascending });
    if (res.error) {
      errors.push(`${table}: ${res.error.message}`);
      return [];
    }
    return (res.data as T[] | null) ?? [];
  } catch (err) {
    errors.push(
      `${table}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
