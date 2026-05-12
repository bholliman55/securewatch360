import { describe, expect, it, vi } from "vitest";

import { INVESTOR_DEMO_SCENARIO } from "../demoSeedData";
import {
  resetInvestorDemoScenario,
  seedInvestorDemoScenario,
} from "../demoRepository";
import {
  getSpokenSummary,
  runInvestorDemoReplay,
  startInvestorDemoReplay,
  type InvestorDemoReplayEvent,
  type InvestorReplayClock,
  type InvestorReplayLogger,
  type InvestorReplayPublisher,
} from "../demoReplayEngine";
import { makeMemorySupabase } from "./_memorySupabase";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface FakeClock extends InvestorReplayClock {
  totalSlept: number;
  virtualNow: number;
}

function makeFakeClock(): FakeClock {
  const c: FakeClock = {
    totalSlept: 0,
    virtualNow: 0,
    now() {
      return c.virtualNow;
    },
    async sleep(ms: number) {
      c.totalSlept += ms;
      c.virtualNow += ms;
    },
  };
  return c;
}

function makeNullLogger(): InvestorReplayLogger {
  return { info: () => {}, warn: () => {} };
}

function makeRecordingPublisher(): {
  publisher: InvestorReplayPublisher;
  events: InvestorDemoReplayEvent[];
} {
  const events: InvestorDemoReplayEvent[] = [];
  return {
    events,
    publisher: {
      async publish(e) {
        events.push(e);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Event emission order
// ---------------------------------------------------------------------------

describe("startInvestorDemoReplay — event order", () => {
  it("emits every event_order in ascending order", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    const { publisher, events } = makeRecordingPublisher();

    const result = await runInvestorDemoReplay(
      {
        instant: true,
        publisher,
        logger: makeNullLogger(),
        clock: makeFakeClock(),
      },
      client,
    );

    expect(result.ok).toBe(true);
    expect(result.finalState).toBe("completed");
    expect(events.length).toBe(INVESTOR_DEMO_SCENARIO.timeline.length);

    const orders = events.map((e) => e.event_order);
    const expected = INVESTOR_DEMO_SCENARIO.timeline.map((t) => t.event_order);
    expect(orders).toEqual(expected);

    const types = events.map((e) => e.event_type);
    const expectedTypes = INVESTOR_DEMO_SCENARIO.timeline.map((t) => t.event_type);
    expect(types).toEqual(expectedTypes);
  });

  it("each emitted event carries a non-empty spoken_summary", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    const { publisher, events } = makeRecordingPublisher();

    await runInvestorDemoReplay(
      {
        instant: true,
        publisher,
        logger: makeNullLogger(),
        clock: makeFakeClock(),
      },
      client,
    );

    for (const ev of events) {
      expect(ev.spoken_summary.length).toBeGreaterThan(0);
      // ElevenLabs-friendly: keep each line short enough to read calmly.
      expect(ev.spoken_summary.length).toBeLessThan(220);
    }
  });
});

// ---------------------------------------------------------------------------
// Instant mode
// ---------------------------------------------------------------------------

describe("startInvestorDemoReplay — instant mode", () => {
  it("never calls clock.sleep when instant=true", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    const clock = makeFakeClock();
    const sleepSpy = vi.spyOn(clock, "sleep");

    await runInvestorDemoReplay(
      {
        instant: true,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock,
      },
      client,
    );

    expect(sleepSpy).not.toHaveBeenCalled();
    expect(clock.totalSlept).toBe(0);
  });

  it("respects speedMultiplier with the virtual clock", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    const clock = makeFakeClock();

    await runInvestorDemoReplay(
      {
        speedMultiplier: 10,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock,
      },
      client,
    );
    // Last event is at offset 55s; at 10x that's 5,500 virtual ms.
    expect(clock.totalSlept).toBeLessThanOrEqual(5500);
  });

  it("rejects invalid speedMultiplier", () => {
    const { client } = makeMemorySupabase();
    expect(() =>
      startInvestorDemoReplay(
        {
          speedMultiplier: 0,
          publisher: { async publish() {} },
          logger: makeNullLogger(),
        },
        client,
      ),
    ).toThrow(/invalid speedMultiplier/);
  });
});

// ---------------------------------------------------------------------------
// Reset before replay
// ---------------------------------------------------------------------------

describe("startInvestorDemoReplay — reset before replay", () => {
  it("a clean reset → run produces the same emission sequence as the first run", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const firstRecording = makeRecordingPublisher();
    await runInvestorDemoReplay(
      {
        instant: true,
        publisher: firstRecording.publisher,
        logger: makeNullLogger(),
        clock: makeFakeClock(),
      },
      client,
    );

    expect(firstRecording.events.length).toBe(15);
    // After the first run: scenario completed, every event emitted.
    const scenario = store.rows
      .get("demo_scenarios")
      ?.find((r) => r.scenario_key === INVESTOR_DEMO_SCENARIO.scenario_key);
    expect(scenario?.status).toBe("completed");

    const resetResult = await resetInvestorDemoScenario(
      INVESTOR_DEMO_SCENARIO.scenario_key,
      client,
    );
    expect(resetResult.ok).toBe(true);

    const secondRecording = makeRecordingPublisher();
    await runInvestorDemoReplay(
      {
        instant: true,
        publisher: secondRecording.publisher,
        logger: makeNullLogger(),
        clock: makeFakeClock(),
      },
      client,
    );

    expect(secondRecording.events.length).toBe(firstRecording.events.length);
    expect(
      secondRecording.events.map((e) => e.event_order),
    ).toEqual(firstRecording.events.map((e) => e.event_order));
  });

  it("fails cleanly when scenario was never seeded", async () => {
    const { client } = makeMemorySupabase();

    const result = await runInvestorDemoReplay(
      {
        instant: true,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock: makeFakeClock(),
      },
      client,
    );

    expect(result.ok).toBe(false);
    expect(result.finalState).toBe("failed");
    expect(result.errors.some((e) => e.includes("load_events"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Asset status transitions
// ---------------------------------------------------------------------------

describe("startInvestorDemoReplay — asset status transitions", () => {
  it("walks LAPTOP-123 and ACME-FS01 through the canonical asset states", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const snapshots: Array<{
      after_event_type: string;
      laptop: string;
      fileServer: string;
    }> = [];

    await runInvestorDemoReplay(
      {
        instant: true,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock: makeFakeClock(),
        onEvent: (ev) => {
          const assets = store.rows.get("demo_assets") ?? [];
          const laptop = assets.find((a) => a.asset_name === "LAPTOP-123");
          const fileServer = assets.find((a) => a.asset_name === "ACME-FS01");
          snapshots.push({
            after_event_type: ev.event_type,
            laptop: String(laptop?.status ?? ""),
            fileServer: String(fileServer?.status ?? ""),
          });
        },
      },
      client,
    );

    const after = (eventType: string) =>
      snapshots.find((s) => s.after_event_type === eventType);

    // 3s — LAPTOP-123 → suspicious
    expect(after("detection_powershell")?.laptop).toBe("suspicious");
    // 9s — LAPTOP-123 → compromised_simulated
    expect(after("detection_credential_access")?.laptop).toBe(
      "compromised_simulated",
    );
    // 21s — ACME-FS01 → at_risk
    expect(after("containment_recommended")?.fileServer).toBe("at_risk");
    // 33s — LAPTOP-123 → isolated_simulated
    expect(after("endpoint_isolated")?.laptop).toBe("isolated_simulated");

    // Final asset state reflects the simulated-isolated terminal status.
    const finalAssets = store.rows.get("demo_assets") ?? [];
    const finalLaptop = finalAssets.find((a) => a.asset_name === "LAPTOP-123");
    expect(finalLaptop?.status).toBe("isolated_simulated");

    // Scenario completes.
    const scenario = store.rows
      .get("demo_scenarios")
      ?.find((r) => r.scenario_key === INVESTOR_DEMO_SCENARIO.scenario_key);
    expect(scenario?.status).toBe("completed");
  });

  it("walks demo_actions through awaiting_confirmation → confirmed → executed", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const captured: Array<{
      after_event_type: string;
      isolate_status: string;
      isolate_confirmed: boolean;
      ticket_status: string;
    }> = [];

    await runInvestorDemoReplay(
      {
        instant: true,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock: makeFakeClock(),
        onEvent: (ev) => {
          const actions = store.rows.get("demo_actions") ?? [];
          const isolate = actions.find(
            (a) => a.action_type === "isolate_endpoint",
          );
          const ticket = actions.find(
            (a) => a.action_type === "create_remediation_ticket",
          );
          captured.push({
            after_event_type: ev.event_type,
            isolate_status: String(isolate?.status ?? ""),
            isolate_confirmed: isolate?.confirmed === true,
            ticket_status: String(ticket?.status ?? ""),
          });
        },
      },
      client,
    );

    const after = (t: string) => captured.find((c) => c.after_event_type === t);

    expect(after("containment_recommended")?.isolate_status).toBe(
      "awaiting_confirmation",
    );
    expect(after("admin_confirmation_received")?.isolate_status).toBe(
      "confirmed",
    );
    expect(after("admin_confirmation_received")?.isolate_confirmed).toBe(true);
    expect(after("endpoint_isolated")?.isolate_status).toBe("executed");
    expect(after("ticket_created")?.ticket_status).toBe("executed");
  });
});

// ---------------------------------------------------------------------------
// Pause / resume / stop
// ---------------------------------------------------------------------------

describe("startInvestorDemoReplay — pause / resume / stop", () => {
  it("pause and resume let the replay finish", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    const { publisher, events } = makeRecordingPublisher();

    let pauseTriggered = false;
    const handle = startInvestorDemoReplay(
      {
        instant: true,
        publisher,
        logger: makeNullLogger(),
        clock: makeFakeClock(),
        onEvent: () => {
          if (events.length === 3 && !pauseTriggered) {
            pauseTriggered = true;
            handle.pause();
            // Resume once the current microtask drains.
            queueMicrotask(() => handle.resume());
          }
        },
      },
      client,
    );

    const result = await handle.completion;
    expect(pauseTriggered).toBe(true);
    expect(result.finalState).toBe("completed");
    expect(result.emittedEventCount).toBe(15);
    expect(events.length).toBe(15);
  });

  it("stop() halts the replay early with finalState=stopped", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const handle = startInvestorDemoReplay(
      {
        instant: true,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock: makeFakeClock(),
        onEvent: () => {
          handle.stop();
        },
      },
      client,
    );

    const result = await handle.completion;
    expect(result.finalState).toBe("stopped");
    expect(result.emittedEventCount).toBe(1);
  });

  it("stop() unblocks a paused replay", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const handle = startInvestorDemoReplay(
      {
        instant: true,
        publisher: { async publish() {} },
        logger: makeNullLogger(),
        clock: makeFakeClock(),
        onEvent: () => {
          // Pause after the first event, then stop on the next microtask.
          if (handle.state() !== "paused") {
            handle.pause();
            queueMicrotask(() => handle.stop());
          }
        },
      },
      client,
    );

    const result = await handle.completion;
    expect(result.finalState).toBe("stopped");
    expect(result.emittedEventCount).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------------------
// No real external calls
// ---------------------------------------------------------------------------

describe("startInvestorDemoReplay — no real external calls", () => {
  it("never calls global fetch during a full replay", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const fetchSpy = vi.fn();
    const original = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;

    try {
      const result = await runInvestorDemoReplay(
        {
          instant: true,
          publisher: { async publish() {} },
          logger: makeNullLogger(),
          clock: makeFakeClock(),
        },
        client,
      );
      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = original;
    }
  });

  it("default publisher is a no-op when supabase has no realtime channel", async () => {
    // The in-memory supabase facade exposes only `from()`, no `channel()`.
    // The engine should detect this and fall back to a silent publisher,
    // proving the DB updates alone are the polling-friendly fallback path.
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const result = await runInvestorDemoReplay(
      {
        instant: true,
        // publisher omitted → engine builds default
        logger: makeNullLogger(),
        clock: makeFakeClock(),
      },
      client,
    );
    expect(result.ok).toBe(true);
    expect(result.emittedEventCount).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Spoken summary helper
// ---------------------------------------------------------------------------

describe("getSpokenSummary", () => {
  it("returns hand-crafted lines for canonical event types", () => {
    const line = getSpokenSummary("demo_started", "Demo started");
    expect(line.length).toBeGreaterThan(0);
    expect(line.length).toBeLessThan(220);
  });

  it("falls back to a simulated-tagged line for unknown event types", () => {
    const line = getSpokenSummary("unknown_event", "Anomalous Login Detected");
    expect(line).toContain("simulated");
  });
});
