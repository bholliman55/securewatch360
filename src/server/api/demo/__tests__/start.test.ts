import { describe, expect, it, vi } from "vitest";

import { handleStart } from "../start";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

import type { ReplayStoreLike } from "../types";

function makeStubReplayStore(initialState: "idle" | "running" = "running"): ReplayStoreLike {
  let currentState = initialState;
  return {
    startReplay: vi.fn(({ speedMultiplier, instant }) => ({
      handle: {
        scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key,
        state: () => currentState,
      },
      reused: false,
      // Side-effect: capture inputs for assertions.
      _capturedSpeed: speedMultiplier,
      _capturedInstant: instant,
    })) as unknown as ReplayStoreLike["startReplay"],
    pauseActiveReplay: vi.fn(() => ({ ok: true })),
    resumeActiveReplay: vi.fn(() => ({ ok: true })),
    stopActiveReplay: vi.fn(() => ({ ok: true })),
    clearActiveReplay: () => {
      currentState = "idle";
    },
    getReplayStatus: vi.fn(() => ({
      hasActive: true,
      state: currentState,
      scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key,
      speedMultiplier: 1,
      startedAt: new Date().toISOString(),
      emittedEventCount: 0,
    })),
  };
}

describe("handleStart", () => {
  it("starts a replay with the default speed multiplier of 1", async () => {
    const replayStore = makeStubReplayStore();

    const result = await handleStart({}, { replayStore });

    expect(result.ok).toBe(true);
    expect(result.scenarioKey).toBe(INVESTOR_DEMO_SCENARIO.scenario_key);
    expect(result.speedMultiplier).toBe(1);
    expect(result.instant).toBe(false);
    expect(result.state).toBe("running");
    expect(replayStore.startReplay).toHaveBeenCalledWith({
      speedMultiplier: 1,
      instant: false,
    });
  });

  it("clamps invalid speed multipliers to 1", async () => {
    const replayStore = makeStubReplayStore();

    const negative = await handleStart({ speedMultiplier: -3 }, { replayStore });
    const zero = await handleStart({ speedMultiplier: 0 }, { replayStore });
    const nan = await handleStart({ speedMultiplier: NaN }, { replayStore });

    expect(negative.speedMultiplier).toBe(1);
    expect(zero.speedMultiplier).toBe(1);
    expect(nan.speedMultiplier).toBe(1);
  });

  it("respects a valid speed multiplier", async () => {
    const replayStore = makeStubReplayStore();

    const result = await handleStart({ speedMultiplier: 5 }, { replayStore });

    expect(result.speedMultiplier).toBe(5);
    expect(replayStore.startReplay).toHaveBeenLastCalledWith({
      speedMultiplier: 5,
      instant: false,
    });
  });

  it("forwards the instant flag", async () => {
    const replayStore = makeStubReplayStore();

    const result = await handleStart({ instant: true }, { replayStore });

    expect(result.instant).toBe(true);
    expect(replayStore.startReplay).toHaveBeenLastCalledWith({
      speedMultiplier: 1,
      instant: true,
    });
  });

  it("returns ok=false when the replay store throws", async () => {
    const replayStore: ReplayStoreLike = {
      ...makeStubReplayStore(),
      startReplay: () => {
        throw new Error("engine offline");
      },
    };

    const result = await handleStart({}, { replayStore });

    expect(result.ok).toBe(false);
    expect(result.state).toBe("failed");
    expect(result.errors).toContain("engine offline");
  });
});
