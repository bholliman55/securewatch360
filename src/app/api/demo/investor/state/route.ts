import { NextResponse } from "next/server";

import {
  INVESTOR_DEMO_SCENARIO,
  type DemoActionRow,
  type DemoAgentReasoningRow,
  type DemoAssetRow,
  type DemoClientRow,
  type DemoEventRow,
  type DemoMetricRow,
  type DemoReportRow,
  type DemoScenarioRow,
} from "@/demo/investorMode";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getReplayStatus } from "@/server/demo/investorReplayStore";

/**
 * GET /api/demo/investor/state
 *
 * Returns a single snapshot of every demo_* row for the canonical scenario
 * key. The InvestorMode UI uses this:
 *  1. on initial mount (server-render path),
 *  2. as a polling fallback when Supabase realtime is unavailable.
 *
 * Best-effort — if a query fails the corresponding field is returned as []
 * or null along with an error in `errors`.
 */
export async function GET(): Promise<Response> {
  const scenarioKey = INVESTOR_DEMO_SCENARIO.scenario_key;
  const supabase = getSupabaseAdminClient();
  const errors: string[] = [];

  async function safeSelect<T>(
    table: string,
    builder: (q: ReturnType<typeof supabase.from>) => unknown,
  ): Promise<T[]> {
    try {
      const res = (await builder(supabase.from(table))) as {
        data: T[] | null;
        error: { message: string } | null;
      };
      if (res.error) {
        errors.push(`${table}: ${res.error.message}`);
        return [];
      }
      return res.data ?? [];
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  const [scenarioRows, clientRows, assets, events, reasoning, actions, metrics, reports] =
    await Promise.all([
      safeSelect<DemoScenarioRow>("demo_scenarios", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).limit(1),
      ),
      safeSelect<DemoClientRow>("demo_clients", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).limit(1),
      ),
      safeSelect<DemoAssetRow>("demo_assets", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).order("asset_name", { ascending: true }),
      ),
      safeSelect<DemoEventRow>("demo_events", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).order("event_order", { ascending: true }),
      ),
      safeSelect<DemoAgentReasoningRow>("demo_agent_reasoning", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).order("created_at", { ascending: true }),
      ),
      safeSelect<DemoActionRow>("demo_actions", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).order("created_at", { ascending: true }),
      ),
      safeSelect<DemoMetricRow>("demo_metrics", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).order("sort_order", { ascending: true }),
      ),
      safeSelect<DemoReportRow>("demo_reports", (q) =>
        q.select("*").eq("scenario_key", scenarioKey).order("created_at", { ascending: false }),
      ),
    ]);

  return NextResponse.json({
    ok: errors.length === 0,
    scenarioKey,
    scenario: scenarioRows[0] ?? null,
    client: clientRows[0] ?? null,
    assets,
    events,
    reasoning,
    actions,
    metrics,
    reports,
    replay: getReplayStatus(),
    errors,
  });
}
