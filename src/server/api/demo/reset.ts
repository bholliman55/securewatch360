/**
 * `POST /api/demo/reset` service handler.
 *
 * Stops any active replay (so the next run starts cleanly), then wipes
 * per-run state in Supabase: events back to `pending`, assets back to
 * `healthy`, actions back to `pending`, generated reports cleared while
 * "Seed: …" templates are preserved, and the scenario row back to
 * `ready`.
 */

import {
  INVESTOR_DEMO_SCENARIO,
  resetInvestorDemoScenario,
} from "@/demo/investorMode";
import { clearActiveReplay } from "@/server/demo/investorReplayStore";

import type { DemoServiceDeps, ResetResult } from "./types";

export async function handleReset(
  deps: DemoServiceDeps = {},
): Promise<ResetResult> {
  const errors: string[] = [];
  const scenarioKey = INVESTOR_DEMO_SCENARIO.scenario_key;

  try {
    if (deps.replayStore) {
      deps.replayStore.clearActiveReplay();
    } else {
      clearActiveReplay();
    }
  } catch (err) {
    errors.push(
      `clearActiveReplay: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const result = await resetInvestorDemoScenario(
      INVESTOR_DEMO_SCENARIO.scenario_key,
      deps.supabase,
    );
    if (!result.ok) errors.push(...result.errors);
    return {
      ok: result.ok && errors.length === 0,
      scenarioKey: result.scenarioKey,
      reset: result.reset,
      message: result.ok
        ? "Investor demo reset to a clean state."
        : "Investor demo reset reported errors — see `errors`.",
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      ok: false,
      scenarioKey,
      reset: {
        scenario_status: false,
        asset_statuses: false,
        event_statuses: false,
        action_statuses: false,
        non_template_reports: false,
      },
      message: "Investor demo reset failed.",
      errors,
    };
  }
}
