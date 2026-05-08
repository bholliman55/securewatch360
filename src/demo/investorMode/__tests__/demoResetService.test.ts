import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetInMemoryStoreForTests,
  createInMemoryDemoSink,
  DEMO_SCENARIO_ID,
} from "../demoConfig";
import { runDemoReplaySynchronously } from "../demoReplayEngine";
import { resetDemo } from "../demoResetService";
import type { DemoEvent, DemoEventSink } from "../demoEventTypes";

afterEach(() => {
  __resetInMemoryStoreForTests();
});

describe("resetDemo", () => {
  it("wipes every persisted event for the canonical scenario", async () => {
    const sink = createInMemoryDemoSink();
    const events = await runDemoReplaySynchronously({ sink });
    expect(events.length).toBeGreaterThan(0);

    const result = await resetDemo({ sink });
    expect(result.ok).toBe(true);
    expect(result.scenarioId).toBe(DEMO_SCENARIO_ID);
    expect(result.sink).toBe("memory");
    expect(result.error).toBeUndefined();

    const after = await sink.list(events[0]!.demoRunId);
    expect(after).toEqual([]);
  });

  it("returns the seed snapshot so callers can re-arm the UI", async () => {
    const sink = createInMemoryDemoSink();
    const result = await resetDemo({ sink });
    expect(result.seed.client.name).toBe("Acme Dental");
    expect(result.seed.asset.hostname).toBe("ACME-FS01");
    expect(result.seed.endpoint.hostname).toBe("LAPTOP-123");
    expect(result.seed.user.fullName).toBe("Sarah Mitchell");
    expect(result.seed.exposure.protocol).toBe("tcp");
    expect(result.seed.controls.length).toBeGreaterThan(0);
  });

  it("is idempotent — calling reset twice yields the same outcome", async () => {
    const sink = createInMemoryDemoSink();
    await runDemoReplaySynchronously({ sink });
    const first = await resetDemo({ sink });
    const second = await resetDemo({ sink });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.scenarioId).toBe(second.scenarioId);
  });

  it("captures sink failures into a structured error rather than throwing", async () => {
    const failing: DemoEventSink = {
      kind: "memory",
      async persist(): Promise<void> {
        /* unused */
      },
      async list(): Promise<DemoEvent[]> {
        return [];
      },
      async reset(): Promise<void> {
        throw new Error("boom");
      },
    };
    const result = await resetDemo({ sink: failing });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/boom/);
    expect(result.seed.client.name).toBe("Acme Dental");
  });

  it("delegates the wipe to the sink with the canonical scenario id", async () => {
    const sinkResetSpy = vi.fn(async () => {});
    const sink: DemoEventSink = {
      kind: "memory",
      async persist(): Promise<void> {
        /* unused */
      },
      async list(): Promise<DemoEvent[]> {
        return [];
      },
      reset: sinkResetSpy,
    };
    await resetDemo({ sink });
    expect(sinkResetSpy).toHaveBeenCalledWith(DEMO_SCENARIO_ID);
  });
});
