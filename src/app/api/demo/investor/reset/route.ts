import { NextResponse } from "next/server";

import { resetInvestorDemoScenario } from "@/demo/investorMode";
import { clearActiveReplay } from "@/server/demo/investorReplayStore";

/**
 * POST /api/demo/investor/reset
 *
 * Stops any active replay, clears the singleton handle, then wipes per-run
 * state in the demo_* tables. Restores the scenario to status='ready' with
 * pending events, healthy assets, and pending actions.
 */
export async function POST(): Promise<Response> {
  try {
    clearActiveReplay();
    const result = await resetInvestorDemoScenario();
    return NextResponse.json({
      ok: result.ok,
      scenarioKey: result.scenarioKey,
      reset: result.reset,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
