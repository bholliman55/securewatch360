/**
 * `npm run demo:seed` — seed every investor-demo Supabase table from
 * INVESTOR_DEMO_SCENARIO. Idempotent: safe to run multiple times.
 */

import { requireSupabaseEnv } from "./_env";

requireSupabaseEnv();

import { getSupabaseAdminClient } from "../../src/lib/supabase";
import {
  INVESTOR_DEMO_SCENARIO,
  seedInvestorDemoScenario,
} from "../../src/demo/investorMode";

async function main(): Promise<void> {
  const client = getSupabaseAdminClient();
  const result = await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

  if (!result.ok) {
    console.error("\n[demo:seed] seeding failed");
    for (const err of result.errors) {
      console.error("  -", err);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Investor demo seeded");
  console.log(
    `  scenario_key      : ${result.scenarioKey}`,
  );
  console.log(`  scenario rows     : ${result.counts.scenario}`);
  console.log(`  client rows       : ${result.counts.client}`);
  console.log(`  asset rows        : ${result.counts.assets}`);
  console.log(`  event rows        : ${result.counts.events}`);
  console.log(`  reasoning rows    : ${result.counts.reasoning}`);
  console.log(`  action rows       : ${result.counts.actions}`);
  console.log(`  report templates  : ${result.counts.report_templates}`);
  console.log(`  metric rows       : ${result.counts.metrics}`);
}

main().catch((err) => {
  console.error("[demo:seed] unhandled error", err);
  process.exit(1);
});
