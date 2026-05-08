/**
 * Replay engine for the investor demo.
 *
 * Drives the canonical {@link DEMO_TIMELINE} through a sink, with two modes:
 *
 *  - **scheduled** (default): each step fires after `offsetSeconds /
 *    speedMultiplier` real seconds via `setTimeout`. Investor demos run in
 *    this mode.
 *  - **manual**: callers advance step-by-step via `tick()`. Used by tests
 *    and by any "run the demo as fast as the UI can render" tooling.
 *
 * The engine is deliberately framework-agnostic: it depends only on the
 * `DemoEventSink` contract and a clock function, both of which can be
 * swapped in tests. No Supabase, Inngest, or Next-specific imports.
 */

import { DEMO_SCENARIO_ID, DEFAULT_DEMO_SPEED_MULTIPLIER } from "./demoConfig";
import {
  DEMO_TIMELINE,
  DEMO_TOTAL_DURATION_SECONDS,
  assertTimelineInvariants,
} from "./demoScenario";
import type { DemoEvent, DemoEventSink, DemoTimelineStep } from "./demoEventTypes";

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface ReplayClock {
  /** Current wall-clock ms since epoch. */
  now(): number;
  /** Schedule a callback after `ms` real milliseconds, return a cancel fn. */
  setTimeout(cb: () => void, ms: number): () => void;
}

export interface ReplayStartOptions {
  /** Demo run id (UUID-ish). One is generated if omitted. */
  demoRunId?: string;
  /** Speed multiplier (1 = real-time, 10 = ten-times faster). */
  speedMultiplier?: number;
  /** Sink override — defaults to the result of `resolveDemoSink()`. */
  sink: DemoEventSink;
  /** Clock override — defaults to the global one. */
  clock?: ReplayClock;
  /** Optional listener fired with each event after it has been persisted. */
  onEvent?: (event: DemoEvent) => void;
}

export interface ReplayHandle {
  /** Run id assigned to this replay. */
  readonly demoRunId: string;
  /** Promise that resolves once the final event has been emitted. */
  readonly completion: Promise<void>;
  /** Stop the replay. Pending steps are dropped, completion still resolves. */
  cancel(): void;
}

export interface ManualReplayOptions {
  demoRunId?: string;
  sink: DemoEventSink;
  clock?: ReplayClock;
}

export interface ManualReplayHandle {
  readonly demoRunId: string;
  /** Emit the next step. Returns the event, or null when timeline is exhausted. */
  tick(): Promise<DemoEvent | null>;
  /** Number of steps already emitted. */
  readonly emittedCount: number;
  /** Total steps in the timeline. */
  readonly totalSteps: number;
}

// ---------------------------------------------------------------------------
// Default clock and id helpers
// ---------------------------------------------------------------------------

const defaultClock: ReplayClock = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => {
    const handle = setTimeout(cb, ms);
    return () => clearTimeout(handle);
  },
};

function generateRunId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}-${random}`;
}

function generateEventId(): string {
  // Lightweight uuid-v4-shaped id — investor demo only, not crypto-grade.
  const r = (n: number) => Math.random().toString(16).slice(2, 2 + n);
  return `${r(8)}-${r(4)}-4${r(3)}-a${r(3)}-${r(12)}`;
}

// ---------------------------------------------------------------------------
// Step → DemoEvent materialisation
// ---------------------------------------------------------------------------

function materialise(
  step: DemoTimelineStep,
  demoRunId: string,
  emittedAt: string,
): DemoEvent {
  return {
    id: generateEventId(),
    demoRunId,
    scenarioId: DEMO_SCENARIO_ID,
    emittedAt,
    ...step,
  };
}

// ---------------------------------------------------------------------------
// Scheduled replay (real-time-ish)
// ---------------------------------------------------------------------------

/**
 * Start a scheduled replay of the demo. The function returns synchronously
 * with a handle whose `completion` promise resolves when the timeline
 * finishes (or when `cancel()` is called).
 */
export function startDemoReplay(options: ReplayStartOptions): ReplayHandle {
  assertTimelineInvariants();

  const speed = options.speedMultiplier ?? DEFAULT_DEMO_SPEED_MULTIPLIER;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`[demoReplayEngine] invalid speedMultiplier: ${speed}`);
  }

  const clock = options.clock ?? defaultClock;
  const demoRunId = options.demoRunId ?? generateRunId("demo-run");
  const cancellers: Array<() => void> = [];
  let cancelled = false;

  let resolveCompletion!: () => void;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const totalSteps = DEMO_TIMELINE.length;
  let emittedSteps = 0;

  const emit = async (step: DemoTimelineStep): Promise<void> => {
    if (cancelled) return;
    const event = materialise(step, demoRunId, new Date(clock.now()).toISOString());
    await options.sink.persist(event);
    options.onEvent?.(event);
    emittedSteps += 1;
    if (emittedSteps >= totalSteps) {
      resolveCompletion();
    }
  };

  for (const stepDef of DEMO_TIMELINE) {
    const delayMs = (stepDef.offsetSeconds * 1000) / speed;
    const cancelFn = clock.setTimeout(() => {
      void emit(stepDef);
    }, delayMs);
    cancellers.push(cancelFn);
  }

  return {
    demoRunId,
    completion,
    cancel: () => {
      cancelled = true;
      for (const c of cancellers) c();
      resolveCompletion();
    },
  };
}

// ---------------------------------------------------------------------------
// Manual replay (tests, scripts)
// ---------------------------------------------------------------------------

/**
 * Build a manual replay that advances one step per `tick()`. Used by unit
 * tests and the QA CLI so the entire timeline runs synchronously.
 */
export function createManualDemoReplay(
  options: ManualReplayOptions,
): ManualReplayHandle {
  assertTimelineInvariants();

  const clock = options.clock ?? defaultClock;
  const demoRunId = options.demoRunId ?? generateRunId("demo-run-manual");
  let cursor = 0;

  const handle: ManualReplayHandle = {
    demoRunId,
    totalSteps: DEMO_TIMELINE.length,
    get emittedCount(): number {
      return cursor;
    },
    async tick(): Promise<DemoEvent | null> {
      if (cursor >= DEMO_TIMELINE.length) return null;
      const stepDef = DEMO_TIMELINE[cursor]!;
      const emittedAt = new Date(clock.now()).toISOString();
      const event = materialise(stepDef, demoRunId, emittedAt);
      await options.sink.persist(event);
      cursor += 1;
      return event;
    },
  };

  return handle;
}

/** Convenience: emit every step synchronously (useful for tests). */
export async function runDemoReplaySynchronously(
  options: ManualReplayOptions,
): Promise<DemoEvent[]> {
  const handle = createManualDemoReplay(options);
  const out: DemoEvent[] = [];
  while (handle.emittedCount < handle.totalSteps) {
    const ev = await handle.tick();
    if (ev) out.push(ev);
  }
  return out;
}

/** Re-export so consumers don't need a second import. */
export { DEMO_TIMELINE, DEMO_TOTAL_DURATION_SECONDS };
