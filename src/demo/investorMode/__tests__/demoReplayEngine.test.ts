import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetInMemoryStoreForTests,
  createInMemoryDemoSink,
} from "../demoConfig";
import {
  DEMO_TIMELINE,
  DEMO_TOTAL_DURATION_SECONDS,
  assertTimelineInvariants,
} from "../demoScenario";
import {
  createManualDemoReplay,
  runDemoReplaySynchronously,
  startDemoReplay,
  type ReplayClock,
} from "../demoReplayEngine";
import type { DemoEvent } from "../demoEventTypes";

/**
 * Tiny virtual clock used to drive `startDemoReplay` deterministically.
 * Pending callbacks live in a sorted list and `advance()` fires every
 * callback whose due time has been reached.
 */
function createVirtualClock(): ReplayClock & {
  advance(ms: number): void;
  pendingCount(): number;
} {
  let nowMs = 0;
  let nextHandle = 1;
  const pending = new Map<number, { dueAt: number; cb: () => void }>();

  return {
    now(): number {
      return nowMs;
    },
    setTimeout(cb: () => void, ms: number): () => void {
      const handle = nextHandle++;
      pending.set(handle, { dueAt: nowMs + ms, cb });
      return () => pending.delete(handle);
    },
    advance(ms: number): void {
      const target = nowMs + ms;
      while (true) {
        let nextEntry: { handle: number; dueAt: number; cb: () => void } | null = null;
        for (const [h, e] of pending.entries()) {
          if (e.dueAt <= target && (!nextEntry || e.dueAt < nextEntry.dueAt)) {
            nextEntry = { handle: h, dueAt: e.dueAt, cb: e.cb };
          }
        }
        if (!nextEntry) break;
        pending.delete(nextEntry.handle);
        nowMs = nextEntry.dueAt;
        nextEntry.cb();
      }
      nowMs = target;
    },
    pendingCount(): number {
      return pending.size;
    },
  };
}

afterEach(() => {
  __resetInMemoryStoreForTests();
});

describe("demoScenario invariants", () => {
  it("validates the canonical timeline at module load", () => {
    expect(() => assertTimelineInvariants()).not.toThrow();
  });

  it("starts with demo_started and ends with demo_completed", () => {
    expect(DEMO_TIMELINE[0]!.type).toBe("demo_started");
    expect(DEMO_TIMELINE[DEMO_TIMELINE.length - 1]!.type).toBe("demo_completed");
  });

  it("matches the spec offsets exactly", () => {
    const expected: Array<{ type: string; offsetSeconds: number }> = [
      { type: "demo_started", offsetSeconds: 0 },
      { type: "detection_powershell", offsetSeconds: 3 },
      { type: "detection_file_access", offsetSeconds: 6 },
      { type: "detection_credential_access", offsetSeconds: 9 },
      { type: "agent_classification", offsetSeconds: 12 },
      { type: "agent_correlation", offsetSeconds: 15 },
      { type: "agent_compliance_check", offsetSeconds: 18 },
      { type: "containment_recommended", offsetSeconds: 21 },
      { type: "voice_confirmation_requested", offsetSeconds: 24 },
      { type: "admin_confirmation_received", offsetSeconds: 30 },
      { type: "endpoint_isolated", offsetSeconds: 33 },
      { type: "ticket_created", offsetSeconds: 37 },
      { type: "executive_report_generated", offsetSeconds: 42 },
      { type: "business_impact_summary_generated", offsetSeconds: 48 },
      { type: "demo_completed", offsetSeconds: 55 },
    ];
    const actual = DEMO_TIMELINE.map((s) => ({
      type: s.type,
      offsetSeconds: s.offsetSeconds,
    }));
    expect(actual).toEqual(expected);
  });

  it("DEMO_TOTAL_DURATION_SECONDS aligns with the final offset", () => {
    expect(DEMO_TOTAL_DURATION_SECONDS).toBe(55);
  });
});

describe("createManualDemoReplay", () => {
  it("emits every step into the sink in order", async () => {
    const sink = createInMemoryDemoSink();
    const handle = createManualDemoReplay({ sink });
    expect(handle.totalSteps).toBe(DEMO_TIMELINE.length);

    const emitted: DemoEvent[] = [];
    while (handle.emittedCount < handle.totalSteps) {
      const event = await handle.tick();
      if (event) emitted.push(event);
    }

    expect(emitted).toHaveLength(DEMO_TIMELINE.length);
    expect(emitted[0]!.type).toBe("demo_started");
    expect(emitted.at(-1)!.type).toBe("demo_completed");

    const persisted = await sink.list(handle.demoRunId);
    expect(persisted.map((e) => e.type)).toEqual(emitted.map((e) => e.type));
  });

  it("returns null once the timeline is exhausted", async () => {
    const sink = createInMemoryDemoSink();
    const handle = createManualDemoReplay({ sink });
    while (handle.emittedCount < handle.totalSteps) {
      await handle.tick();
    }
    await expect(handle.tick()).resolves.toBeNull();
  });
});

describe("runDemoReplaySynchronously", () => {
  it("returns the full event log in step order", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    expect(events.map((e) => e.step)).toEqual(
      DEMO_TIMELINE.map((s) => s.step),
    );
  });

  it("stamps each event with the same demoRunId and a fresh event id", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    const runIds = new Set(events.map((e) => e.demoRunId));
    expect(runIds.size).toBe(1);
    const eventIds = new Set(events.map((e) => e.id));
    expect(eventIds.size).toBe(events.length);
  });
});

describe("startDemoReplay (scheduled)", () => {
  it("emits all 15 events when the virtual clock advances 55 seconds", async () => {
    const sink = createInMemoryDemoSink();
    const clock = createVirtualClock();
    const observed: DemoEvent[] = [];
    const handle = startDemoReplay({
      sink,
      clock,
      onEvent: (e) => observed.push(e),
    });

    clock.advance(DEMO_TOTAL_DURATION_SECONDS * 1000);
    await handle.completion;

    expect(observed).toHaveLength(DEMO_TIMELINE.length);
    expect(observed.map((e) => e.type)).toEqual(DEMO_TIMELINE.map((s) => s.type));
    const persisted = await sink.list(handle.demoRunId);
    expect(persisted).toHaveLength(DEMO_TIMELINE.length);
  });

  it("respects speedMultiplier — 5x finishes after 11 virtual seconds", async () => {
    const sink = createInMemoryDemoSink();
    const clock = createVirtualClock();
    const handle = startDemoReplay({ sink, clock, speedMultiplier: 5 });
    clock.advance(11 * 1000);
    await handle.completion;
    const persisted = await sink.list(handle.demoRunId);
    expect(persisted).toHaveLength(DEMO_TIMELINE.length);
  });

  it("cancel() drops pending steps and resolves completion", async () => {
    const sink = createInMemoryDemoSink();
    const clock = createVirtualClock();
    const handle = startDemoReplay({ sink, clock });
    clock.advance(10 * 1000);
    handle.cancel();
    await handle.completion;
    const persisted = await sink.list(handle.demoRunId);
    expect(persisted.length).toBeLessThan(DEMO_TIMELINE.length);
    expect(persisted.length).toBeGreaterThan(0);
  });

  it("rejects non-positive speedMultipliers", () => {
    const sink = createInMemoryDemoSink();
    expect(() => startDemoReplay({ sink, speedMultiplier: 0 })).toThrow(
      /invalid speedMultiplier/,
    );
    expect(() => startDemoReplay({ sink, speedMultiplier: -1 })).toThrow(
      /invalid speedMultiplier/,
    );
  });

  it("notifies onEvent for every event", async () => {
    const sink = createInMemoryDemoSink();
    const clock = createVirtualClock();
    const onEvent = vi.fn();
    const handle = startDemoReplay({ sink, clock, onEvent });
    clock.advance(DEMO_TOTAL_DURATION_SECONDS * 1000);
    await handle.completion;
    expect(onEvent).toHaveBeenCalledTimes(DEMO_TIMELINE.length);
  });
});
