/**
 * `npm run demo:reset` — restore the investor-demo scenario to its
 * post-seed state without touching any seeded data.
 *
 *   - demo_scenarios.status        → 'ready'
 *   - demo_assets.status           → 'healthy'
 *   - demo_events.status           → 'pending', emitted_at → null
 *   - demo_actions.status          → 'pending', confirmed=false, executed_at=null
 *   - demo_reports                 → DELETE rows whose title does NOT start with "Seed: "
 */

import { requireSupabaseEnv } from "./_env";

requireSupabaseEnv();

import { getSupabaseAdminClient } from "../../src/lib/supabase";
import {
  INVESTOR_DEMO_SCENARIO,
  resetInvestorDemoScenario,
} from "../../src/demo/investorMode";

async function main(): Promise<void> {
  const client = getSupabaseAdminClient();
  const result = await resetInvestorDemoScenario(
    INVESTOR_DEMO_SCENARIO.scenario_key,
    client,
  );

  if (!result.ok) {
    console.error("\n[demo:reset] reset failed");
    for (const err of result.errors) {
      console.error("  -", err);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Investor demo reset");
  console.log(`  scenario_key          : ${result.scenarioKey}`);
  console.log(`  scenario status       : ${result.reset.scenario_status ? "ready" : "skipped"}`);
  console.log(`  asset statuses        : ${result.reset.asset_statuses ? "healthy" : "skipped"}`);
  console.log(`  event statuses        : ${result.reset.event_statuses ? "pending" : "skipped"}`);
  console.log(`  action statuses       : ${result.reset.action_statuses ? "pending" : "skipped"}`);
  console.log(`  generated reports     : ${result.reset.non_template_reports ? "cleared" : "skipped"}`);
}

main().catch((err) => {
  console.error("[demo:reset] unhandled error", err);
  process.exit(1);
});
