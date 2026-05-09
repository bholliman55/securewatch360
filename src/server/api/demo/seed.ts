/**
 * `POST /api/demo/seed` service handler.
 *
 * Idempotently inserts the canonical Acme Dental scenario into Supabase
 * and returns a small operator-facing summary. The heavy lifting lives in
 * `seedInvestorDemoScenario`; this handler is purely a presentation
 * adapter.
 */

import {
  INVESTOR_DEMO_SCENARIO,
  seedInvestorDemoScenario,
} from "@/demo/investorMode";

import type { DemoServiceDeps, SeedResult } from "./types";

export async function handleSeed(
  deps: DemoServiceDeps = {},
): Promise<SeedResult> {
  const errors: string[] = [];
  try {
    const result = await seedInvestorDemoScenario(
      INVESTOR_DEMO_SCENARIO,
      deps.supabase,
    );
    if (!result.ok) {
      errors.push(...result.errors);
    }
    return {
      ok: result.ok,
      scenarioKey: result.scenarioKey,
      scenarioSummary: {
        name: INVESTOR_DEMO_SCENARIO.name,
        description: INVESTOR_DEMO_SCENARIO.description,
        client: INVESTOR_DEMO_SCENARIO.client.client_name,
        msp: INVESTOR_DEMO_SCENARIO.client.msp_name,
        asset_count: INVESTOR_DEMO_SCENARIO.assets.length,
        event_count: INVESTOR_DEMO_SCENARIO.timeline.length,
        metric_count: INVESTOR_DEMO_SCENARIO.metrics.length,
      },
      counts: result.counts,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      ok: false,
      scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key,
      scenarioSummary: {
        name: INVESTOR_DEMO_SCENARIO.name,
        description: INVESTOR_DEMO_SCENARIO.description,
        client: INVESTOR_DEMO_SCENARIO.client.client_name,
        msp: INVESTOR_DEMO_SCENARIO.client.msp_name,
        asset_count: INVESTOR_DEMO_SCENARIO.assets.length,
        event_count: INVESTOR_DEMO_SCENARIO.timeline.length,
        metric_count: INVESTOR_DEMO_SCENARIO.metrics.length,
      },
      counts: {
        scenario: 0,
        client: 0,
        assets: 0,
        events: 0,
        reasoning: 0,
        actions: 0,
        report_templates: 0,
        metrics: 0,
      },
      errors,
    };
  }
}
