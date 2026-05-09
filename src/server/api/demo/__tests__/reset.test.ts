import { describe, expect, it, vi } from "vitest";

import { handleReset } from "../reset";
import { handleSeed } from "../seed";
import { makeMemorySupabase } from "@/demo/investorMode/__tests__/_memorySupabase";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

import type { ReplayStoreLike } from "../types";

function makeStubReplayStore(): ReplayStoreLike & { clearCalls: number } {
  const store = {
    clearCalls: 0,
    startReplay: vi.fn(() => ({
      handle: { scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key, state: () => "idle" as const },
      reused: false,
    })),
    pauseActiveReplay: vi.fn(() => ({ ok: true })),
    resumeActiveReplay: vi.fn(() => ({ ok: true })),
    stopActiveReplay: vi.fn(() => ({ ok: true })),
    clearActiveReplay() {
      this.clearCalls += 1;
    },
    getReplayStatus: vi.fn(() => ({
      hasActive: false,
      state: null,
      scenarioKey: null,
      speedMultiplier: null,
      startedAt: null,
      emittedEventCount: null,
    })),
  };
  return store;
}

describe("handleReset", () => {
  it("clears the active replay before wiping per-run state", async () => {
    const { client } = makeMemorySupabase();
    const replayStore = makeStubReplayStore();
    await handleSeed({ supabase: client });

    const result = await handleReset({ supabase: client, replayStore });

    expect(replayStore.clearCalls).toBe(1);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/clean state/);
    expect(result.errors).toEqual([]);
  });

  it("restores assets to healthy and events to pending after a simulated run", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    // Simulate a run by mutating rows directly: flip an asset and an event
    // to mid-run states.
    const assets = store.rows.get("demo_assets") ?? [];
    const laptop = assets.find((a) => a["asset_name"] === "LAPTOP-123");
    expect(laptop).toBeDefined();
    if (laptop) laptop["status"] = "compromised_simulated";

    const events = store.rows.get("demo_events") ?? [];
    if (events[0]) {
      events[0]["status"] = "emitted";
      events[0]["emitted_at"] = new Date().toISOString();
    }

    const scenarios = store.rows.get("demo_scenarios") ?? [];
    if (scenarios[0]) scenarios[0]["status"] = "running";

    const result = await handleReset({ supabase: client });

    expect(result.ok).toBe(true);
    expect(result.reset.scenario_status).toBe(true);
    expect(result.reset.asset_statuses).toBe(true);
    expect(result.reset.event_statuses).toBe(true);

    const refreshedLaptop = (store.rows.get("demo_assets") ?? []).find(
      (a) => a["asset_name"] === "LAPTOP-123",
    );
    expect(refreshedLaptop?.["status"]).toBe("healthy");

    const refreshedScenario = (store.rows.get("demo_scenarios") ?? [])[0];
    expect(refreshedScenario?.["status"]).toBe("ready");

    const refreshedEvents = store.rows.get("demo_events") ?? [];
    expect(
      refreshedEvents.every((e) => e["status"] === "pending"),
    ).toBe(true);
  });

  it("works without a replay store and still wipes state", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleReset({ supabase: client });

    expect(result.ok).toBe(true);
  });
});
