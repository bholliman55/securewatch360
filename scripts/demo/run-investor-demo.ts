/**
 * `npm run demo:run` — drive the investor-demo timeline forward in real time.
 *
 *   1. UPDATE demo_scenarios SET status='running'
 *   2. Walk demo_events in event_order ascending, sleeping until each
 *      event's offset_seconds is reached, then UPDATE status='emitted'.
 *   3. UPDATE demo_scenarios SET status='completed'.
 *   4. Print final business-impact metrics from demo_metrics.
 *
 * Pass `DEMO_SPEED=10` (or any positive number) to run faster than
 * real-time — handy for rehearsal.
 */

import { requireSupabaseEnv } from "./_env";

requireSupabaseEnv();

import { getSupabaseAdminClient } from "../../src/lib/supabase";
import {
  INVESTOR_DEMO_SCENARIO,
  runInvestorDemoScenario,
} from "../../src/demo/investorMode";

function parseSpeedFromEnv(): number {
  const raw = process.env.DEMO_SPEED;
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[demo:run] ignoring invalid DEMO_SPEED='${raw}', using 1.0`);
    return 1;
  }
  return n;
}

async function main(): Promise<void> {
  const client = getSupabaseAdminClient();
  const speedMultiplier = parseSpeedFromEnv();

  console.log("Investor demo running");
  console.log(`  scenario_key   : ${INVESTOR_DEMO_SCENARIO.scenario_key}`);
  console.log(`  speed          : ${speedMultiplier}x`);
  console.log(`  total duration : ${55 / speedMultiplier}s (approx)`);
  console.log("");

  const result = await runInvestorDemoScenario(
    { speedMultiplier },
    client,
  );

  console.log("");
  if (!result.ok) {
    console.error("[demo:run] run finished with errors:");
    for (const err of result.errors) console.error("  -", err);
    process.exitCode = 1;
    return;
  }

  console.log("Investor demo completed");
  console.log(`  events emitted : ${result.emittedEventCount}`);
  console.log("");
  console.log("Final business impact metrics:");
  for (const m of result.finalMetrics) {
    console.log(`  - ${m.metric_label.padEnd(34, " ")} ${m.metric_value}`);
  }
}

main().catch((err) => {
  console.error("[demo:run] unhandled error", err);
  process.exit(1);
});
