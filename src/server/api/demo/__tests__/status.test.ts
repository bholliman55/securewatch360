import { describe, expect, it, vi } from "vitest";

import { handleStatus } from "../status";
import { handleSeed } from "../seed";
import { makeMemorySupabase } from "@/demo/investorMode/__tests__/_memorySupabase";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

import type { ReplayStoreLike } from "../types";

function makeStubReplayStore(): ReplayStoreLike {
  return {
    startReplay: vi.fn(),
    pauseActiveReplay: vi.fn(() => ({ ok: true })),
    resumeActiveReplay: vi.fn(() => ({ ok: true })),
    stopActiveReplay: vi.fn(() => ({ ok: true })),
    clearActiveReplay: vi.fn(),
    getReplayStatus: vi.fn(
      (): ReturnType<ReplayStoreLike["getReplayStatus"]> => ({
        hasActive: true,
        state: "running",
        scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key,
        speedMultiplier: 1,
        startedAt: new Date().toISOString(),
        emittedEventCount: 0,
      }),
    ),
  };
}

describe("handleStatus", () => {
  it("returns 'unseeded' before seeding", async () => {
    const { client } = makeMemorySupabase();

    const result = await handleStatus({
      supabase: client,
      replayStore: makeStubReplayStore(),
    });

    expect(result.ok).toBe(true);
    expect(result.scenarioStatus).toBe("unseeded");
    expect(result.currentEvent).toBeNull();
    expect(result.totalCount).toBe(0);
    expect(result.emittedCount).toBe(0);
    expect(result.metrics).toEqual([]);
  });

  it("reflects seeded state and zero emitted events on first read", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleStatus({
      supabase: client,
      replayStore: makeStubReplayStore(),
    });

    expect(result.ok).toBe(true);
    expect(result.scenarioStatus).toBe("ready");
    expect(result.currentEvent).toBeNull();
    expect(result.emittedCount).toBe(0);
    expect(result.totalCount).toBe(INVESTOR_DEMO_SCENARIO.timeline.length);
    expect(result.metrics.length).toBe(INVESTOR_DEMO_SCENARIO.metrics.length);
  });

  it("returns the latest emitted event as currentEvent", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const events = store.rows.get("demo_events") ?? [];
    // Mark the first three events as emitted; the third one becomes the
    // current event because emitted events are sorted by event_order asc and
    // we take the last.
    for (let i = 0; i < 3; i += 1) {
      events[i]!["status"] = "emitted";
      events[i]!["emitted_at"] = new Date(2024, 0, 1, 0, 0, i * 3).toISOString();
    }

    const result = await handleStatus({
      supabase: client,
      replayStore: makeStubReplayStore(),
    });

    expect(result.emittedCount).toBe(3);
    expect(result.currentEvent?.event_order).toBe(events[2]!["event_order"]);
  });

  it("includes the replay-store snapshot", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });
    const replayStore = makeStubReplayStore();

    const result = await handleStatus({ supabase: client, replayStore });

    expect(result.replay.hasActive).toBe(true);
    expect(result.replay.state).toBe("running");
    expect(replayStore.getReplayStatus).toHaveBeenCalledTimes(1);
  });

  it("surfaces Supabase errors in `errors`", async () => {
    const { client, store } = makeMemorySupabase();
    store.errors.set("select:demo_events", "events table down");

    const result = await handleStatus({
      supabase: client,
      replayStore: makeStubReplayStore(),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("events table down"))).toBe(true);
  });
});
