import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildChaosSchedule } from "../chaos/chaosScheduler";
import { applyChaosInjection } from "../chaos/chaosInjector";
import { computeResilienceScore } from "../chaos/resilienceScore";
import { emptyChaosMetrics } from "../chaos/chaosMetrics";
import { CHAOS_SCENARIO_KINDS } from "../chaos/chaosTypes";
import { runChaosLab } from "../chaos/runChaosLab";
import type { SimulatedEvent } from "../types";

describe("chaos scheduler", () => {
  it("cycles catalog when ticks exceed kinds", () => {
    const s = buildChaosSchedule({ ticks: CHAOS_SCENARIO_KINDS.length + 2 });
    expect(s.length).toBe(CHAOS_SCENARIO_KINDS.length + 2);
    expect(s[0]?.kind).toBe(CHAOS_SCENARIO_KINDS[0]);
    expect(s[CHAOS_SCENARIO_KINDS.length]?.kind).toBe(CHAOS_SCENARIO_KINDS[0]);
  });

  it("shuffles deterministically with seed", () => {
    const a = buildChaosSchedule({ ticks: 12, shuffle: true, seed: 99 });
    const b = buildChaosSchedule({ ticks: 12, shuffle: true, seed: 99 });
    expect(a.map((x) => x.kind)).toEqual(b.map((x) => x.kind));
  });
});

describe("chaos injector", () => {
  const base: SimulatedEvent[] = [
    {
      id: "e1",
      scenarioId: "s",
      runId: "r",
      kind: "monitoring.alert.synthetic",
      simulatedAt: "2026-01-01T00:00:00.000Z",
      payload: { x: 1 },
    },
    {
      id: "e2",
      scenarioId: "s",
      runId: "r",
      kind: "finding.synthetic",
      simulatedAt: "2026-01-01T00:00:01.000Z",
      payload: { y: 2 },
    },
  ];

  it("drops events", async () => {
    const out = await applyChaosInjection({
      kind: "dropped_events",
      events: base,
      tickIndex: 0,
    });
    expect(out.events.length).toBeLessThan(base.length);
    expect(out.sideEffects.some((s) => s.tag === "events_dropped")).toBe(true);
  });

  it("duplicates first event", async () => {
    const out = await applyChaosInjection({
      kind: "duplicate_events",
      events: base,
      tickIndex: 1,
    });
    expect(out.events.length).toBe(base.length + 1);
  });
});

describe("resilience score", () => {
  it("returns bounded score", () => {
    const m = emptyChaosMetrics();
    m.recovery_hints_emitted = 5;
    m.events_dropped = 10;
    const r = computeResilienceScore(m);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("runChaosLab", () => {
  const prev = process.env.CHAOS_LAB_SKIP_DELAY;

  beforeEach(() => {
    process.env.CHAOS_LAB_SKIP_DELAY = "true";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.CHAOS_LAB_SKIP_DELAY;
    else process.env.CHAOS_LAB_SKIP_DELAY = prev;
  });

  it("completes a short lab run with metrics and resilience", async () => {
    const report = await runChaosLab({ ticks: 3 });
    expect(report.ticks.length).toBe(3);
    expect(report.metrics.ticks_total).toBe(3);
    expect(typeof report.resilience.score).toBe("number");
  });
});
