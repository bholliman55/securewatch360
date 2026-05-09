import { describe, expect, it } from "vitest";

import { handleSeed } from "../seed";
import { makeMemorySupabase } from "@/demo/investorMode/__tests__/_memorySupabase";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

describe("handleSeed", () => {
  it("seeds the canonical scenario into an empty database", async () => {
    const { client, store } = makeMemorySupabase();

    const result = await handleSeed({ supabase: client });

    expect(result.ok).toBe(true);
    expect(result.scenarioKey).toBe(INVESTOR_DEMO_SCENARIO.scenario_key);
    expect(result.scenarioSummary).toEqual({
      name: INVESTOR_DEMO_SCENARIO.name,
      description: INVESTOR_DEMO_SCENARIO.description,
      client: INVESTOR_DEMO_SCENARIO.client.client_name,
      msp: INVESTOR_DEMO_SCENARIO.client.msp_name,
      asset_count: INVESTOR_DEMO_SCENARIO.assets.length,
      event_count: INVESTOR_DEMO_SCENARIO.timeline.length,
      metric_count: INVESTOR_DEMO_SCENARIO.metrics.length,
    });
    expect(result.errors).toEqual([]);
    expect(result.counts.events).toBeGreaterThan(0);
    expect(result.counts.assets).toBeGreaterThan(0);
    expect(result.counts.metrics).toBeGreaterThan(0);

    expect(store.rows.get("demo_scenarios")?.length).toBe(1);
    expect(store.rows.get("demo_clients")?.length).toBe(1);
    expect(store.rows.get("demo_assets")?.length).toBe(
      INVESTOR_DEMO_SCENARIO.assets.length,
    );
    expect(store.rows.get("demo_events")?.length).toBe(
      INVESTOR_DEMO_SCENARIO.timeline.length,
    );
    expect(store.rows.get("demo_metrics")?.length).toBe(
      INVESTOR_DEMO_SCENARIO.metrics.length,
    );
  });

  it("is idempotent — re-seeding does not duplicate rows", async () => {
    const { client, store } = makeMemorySupabase();

    await handleSeed({ supabase: client });
    const eventCountAfterFirst = store.rows.get("demo_events")?.length ?? 0;
    const result = await handleSeed({ supabase: client });

    expect(result.ok).toBe(true);
    expect(store.rows.get("demo_events")?.length).toBe(eventCountAfterFirst);
    expect(store.rows.get("demo_assets")?.length).toBe(
      INVESTOR_DEMO_SCENARIO.assets.length,
    );
    expect(store.rows.get("demo_metrics")?.length).toBe(
      INVESTOR_DEMO_SCENARIO.metrics.length,
    );
  });

  it("returns ok=false and surfaces errors on a Supabase failure", async () => {
    const { client, store } = makeMemorySupabase();
    store.errors.set("upsert:demo_scenarios", "supabase down");

    const result = await handleSeed({ supabase: client });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("supabase down"))).toBe(true);
    expect(result.scenarioSummary.client).toBe(
      INVESTOR_DEMO_SCENARIO.client.client_name,
    );
  });
});
