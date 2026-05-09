import { describe, expect, it } from "vitest";

import { handleEvents } from "../events";
import { handleSeed } from "../seed";
import { makeMemorySupabase } from "@/demo/investorMode/__tests__/_memorySupabase";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

describe("handleEvents", () => {
  it("returns an empty list before seeding", async () => {
    const { client } = makeMemorySupabase();

    const result = await handleEvents({ supabase: client });

    expect(result.ok).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.scenarioKey).toBe(INVESTOR_DEMO_SCENARIO.scenario_key);
  });

  it("returns every seeded event ordered by event_order ascending", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleEvents({ supabase: client });

    expect(result.ok).toBe(true);
    expect(result.events.length).toBe(INVESTOR_DEMO_SCENARIO.timeline.length);
    for (let i = 1; i < result.events.length; i += 1) {
      expect(result.events[i]!.event_order).toBeGreaterThan(
        result.events[i - 1]!.event_order,
      );
    }
    // First and last events should match the canonical ones from the seed.
    expect(result.events[0]!.offset_seconds).toBe(0);
    expect(result.events[result.events.length - 1]!.offset_seconds).toBe(55);
  });

  it("returns ok=false when the table query fails", async () => {
    const { client, store } = makeMemorySupabase();
    store.errors.set("select:demo_events", "table missing");

    const result = await handleEvents({ supabase: client });

    expect(result.ok).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.errors.some((e) => e.includes("table missing"))).toBe(true);
  });
});
