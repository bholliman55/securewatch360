/**
 * `GET /api/demo/events` service handler.
 *
 * Returns every timeline event for the canonical scenario in
 * `event_order` ascending. Pending and emitted events both come back so
 * the UI can render the full plan and visually fade in rows as they
 * transition.
 */

import {
  INVESTOR_DEMO_SCENARIO,
  type DemoEventRow,
} from "@/demo/investorMode";
import { getSupabaseAdminClient } from "@/lib/supabase";

import type { DemoServiceDeps, EventsResult } from "./types";

export async function handleEvents(
  deps: DemoServiceDeps = {},
): Promise<EventsResult> {
  const supabase = deps.supabase ?? getSupabaseAdminClient();
  const scenarioKey = INVESTOR_DEMO_SCENARIO.scenario_key;
  const errors: string[] = [];

  try {
    const res = await supabase
      .from("demo_events")
      .select("*")
      .eq("scenario_key", scenarioKey)
      .order("event_order", { ascending: true });

    if (res.error) {
      errors.push(`demo_events: ${res.error.message}`);
      return { ok: false, scenarioKey, events: [], errors };
    }

    const events = (res.data as DemoEventRow[] | null) ?? [];
    return { ok: true, scenarioKey, events, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { ok: false, scenarioKey, events: [], errors };
  }
}
