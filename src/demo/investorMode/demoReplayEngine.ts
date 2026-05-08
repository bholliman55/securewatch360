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

// ===========================================================================
// Investor replay engine
// ===========================================================================
//
// The block above this line is the original lightweight in-process replay
// engine that drives the canonical {@link DEMO_TIMELINE} through a
// `DemoEventSink`. The engine below is the production-grade investor demo
// player: it loads a SEEDED scenario from Supabase, walks `demo_events` in
// `event_order`, flips scenario + asset + action statuses at the right
// moments, and broadcasts each emitted event for the live UI to consume.
//
// Why the two engines coexist:
//  - The canonical engine is framework-agnostic and is what tests / scripts
//    use to verify the timeline shape itself.
//  - The investor engine assumes the seed has been applied, talks to
//    Supabase, and is what `npm run demo:run` and the live investor UI
//    drive.
//
// Safety guarantees:
//  - No real EDR / firewall / identity / ticketing API is ever called.
//    Every "isolation" and "ticket" is a row update on a `demo_*` table.
//  - The publisher is optional and best-effort — failures are logged but
//    never break the run. The DB updates themselves are the polling-friendly
//    fallback for any UI that doesn't subscribe to the broadcast channel.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "../../lib/supabase";
import { INVESTOR_DEMO_SCENARIO } from "./demoSeedData";
import type { DemoEventRow, DemoActionRow } from "./demoRepository";

/** Lifecycle of the investor replay handle. */
export type InvestorDemoReplayState =
  | "idle"
  | "running"
  | "paused"
  | "stopped"
  | "completed"
  | "failed";

/** What the engine fans out to the UI / publisher for each emitted event. */
export interface InvestorDemoReplayEvent {
  scenario_key: string;
  event_order: number;
  offset_seconds: number;
  event_type: string;
  severity: string;
  title: string;
  description: string;
  agent_name: string | null;
  payload: Record<string, unknown>;
  emitted_at: string;
  /** Short, calm, executive-friendly TTS line for ElevenLabs. */
  spoken_summary: string;
}

/** Optional clock override for tests (lets us run instantly with virtual time). */
export interface InvestorReplayClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** Optional logger override. Defaults to `console`. */
export interface InvestorReplayLogger {
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
}

/**
 * Pluggable broadcast channel. The default Supabase implementation uses
 * `supabase.channel('demo:investor:<scenario_key>').send({...})`. Tests pass
 * a no-op or a recording publisher.
 */
export interface InvestorReplayPublisher {
  publish(event: InvestorDemoReplayEvent): Promise<void>;
}

export interface InvestorReplayOptions {
  /** Defaults to the canonical scenario key. */
  scenarioKey?: string;
  /** Speed multiplier (1 = real-time). Higher = faster. */
  speedMultiplier?: number;
  /** Skip every wait — fire all events back-to-back. */
  instant?: boolean;
  /** Logger override. */
  logger?: InvestorReplayLogger;
  /** Clock override (used by tests for virtual time). */
  clock?: InvestorReplayClock;
  /**
   * Realtime publisher. Pass `null` to disable explicitly. If omitted, a
   * Supabase realtime channel is created when a Supabase client is available
   * and a no-op publisher is used otherwise.
   */
  publisher?: InvestorReplayPublisher | null;
  /** Listener fired after each emit. Useful for tests. */
  onEvent?: (event: InvestorDemoReplayEvent) => void;
  /** Listener for state transitions. */
  onStateChange?: (state: InvestorDemoReplayState) => void;
}

export interface InvestorReplayResult {
  ok: boolean;
  scenarioKey: string;
  finalState: InvestorDemoReplayState;
  emittedEventCount: number;
  events: InvestorDemoReplayEvent[];
  errors: string[];
}

export interface InvestorReplayHandle {
  readonly scenarioKey: string;
  state(): InvestorDemoReplayState;
  pause(): void;
  resume(): void;
  /** Stop the replay; `completion` will resolve with finalState='stopped'. */
  stop(): void;
  /** Resolves once the replay terminates (completed/stopped/failed). */
  readonly completion: Promise<InvestorReplayResult>;
}

// ---------------------------------------------------------------------------
// Asset + action transitions (deterministic mapping from event_type → side
// effects on demo_assets / demo_actions). This is the table that drives the
// investor narrative; keep it tight and explicit.
// ---------------------------------------------------------------------------

interface AssetTransition {
  event_type: string;
  asset_name: string;
  status: string;
}

const ASSET_TRANSITIONS: ReadonlyArray<AssetTransition> = [
  { event_type: "detection_powershell", asset_name: "LAPTOP-123", status: "suspicious" },
  {
    event_type: "detection_credential_access",
    asset_name: "LAPTOP-123",
    status: "compromised_simulated",
  },
  {
    event_type: "containment_recommended",
    asset_name: "ACME-FS01",
    status: "at_risk",
  },
  {
    event_type: "endpoint_isolated",
    asset_name: "LAPTOP-123",
    status: "isolated_simulated",
  },
];

interface ActionTransition {
  event_type: string;
  action_type: string;
  patch: Partial<
    Pick<
      DemoActionRow,
      "status" | "confirmed" | "result_summary" | "executed_at"
    >
  > & { use_now_for_executed_at?: boolean };
}

const ACTION_TRANSITIONS: ReadonlyArray<ActionTransition> = [
  {
    event_type: "containment_recommended",
    action_type: "isolate_endpoint",
    patch: {
      status: "awaiting_confirmation",
      result_summary: "Containment recommendation queued for human approval (simulated).",
    },
  },
  {
    event_type: "voice_confirmation_requested",
    action_type: "isolate_endpoint",
    patch: {
      status: "awaiting_confirmation",
      result_summary: "Voice confirmation requested from on-call admin (simulated).",
    },
  },
  {
    event_type: "admin_confirmation_received",
    action_type: "isolate_endpoint",
    patch: {
      status: "confirmed",
      confirmed: true,
      result_summary: "Admin confirmation received (simulated).",
    },
  },
  {
    event_type: "endpoint_isolated",
    action_type: "isolate_endpoint",
    patch: {
      status: "executed",
      use_now_for_executed_at: true,
      result_summary: "LAPTOP-123 isolated from network (simulated).",
    },
  },
  {
    event_type: "ticket_created",
    action_type: "create_remediation_ticket",
    patch: {
      status: "executed",
      use_now_for_executed_at: true,
      result_summary:
        "Remediation ticket DEMO-INC-2042 opened with three follow-up tasks (simulated).",
    },
  },
  {
    event_type: "executive_report_generated",
    action_type: "generate_executive_report",
    patch: {
      status: "executed",
      use_now_for_executed_at: true,
      result_summary: "Executive report generated for Acme Dental leadership (simulated).",
    },
  },
  {
    event_type: "business_impact_summary_generated",
    action_type: "generate_business_impact_summary",
    patch: {
      status: "executed",
      use_now_for_executed_at: true,
      result_summary: "Business impact summary generated for investor walkthrough (simulated).",
    },
  },
];

// ---------------------------------------------------------------------------
// Spoken summaries — short, calm, executive-friendly. Tuned for ElevenLabs
// TTS; phrasing avoids jargon, plays well with neutral cadences, and never
// makes claims of real prevention or real attribution.
// ---------------------------------------------------------------------------

const SPOKEN_SUMMARIES: Record<string, string> = {
  demo_started:
    "Starting the simulated ransomware precursor scenario for Acme Dental.",
  detection_powershell:
    "Suspicious PowerShell activity detected on Sarah's laptop. We're watching closely.",
  detection_file_access:
    "The same laptop is now reaching into the file server. The behavior is escalating.",
  detection_credential_access:
    "Credential access attempt observed. We've classified this as a likely ransomware precursor.",
  agent_classification:
    "The threat-monitoring agent has classified the chain with high confidence.",
  agent_correlation:
    "The intelligence agent has tied the entry vector to a stale RDP exposure.",
  agent_compliance_check:
    "The compliance agent flagged HIPAA, CMMC, and NIST CSF impacts. Evidence is being staged.",
  containment_recommended:
    "Containment recommended. Awaiting human authorization to isolate the laptop.",
  voice_confirmation_requested:
    "Asking the on-call admin: should I isolate Laptop one-twenty-three? Please say confirm isolate.",
  admin_confirmation_received:
    "Confirmation received. Proceeding with isolation.",
  endpoint_isolated:
    "Laptop one-twenty-three is now isolated. Sarah retains local access.",
  ticket_created:
    "A remediation ticket has been opened for Northstar Managed I.T. with three follow-up tasks.",
  executive_report_generated:
    "Executive report ready for Acme Dental leadership.",
  business_impact_summary_generated:
    "Business impact summary is ready. Compliance evidence has been generated.",
  demo_completed:
    "Demo complete. The endpoint is contained and the team has the evidence they need.",
};

/**
 * Returns the canonical spoken summary for an event_type, falling back to
 * the event title if we don't have a hand-crafted line.
 */
export function getSpokenSummary(
  eventType: string,
  fallbackTitle: string,
): string {
  return SPOKEN_SUMMARIES[eventType] ?? `${fallbackTitle} (simulated).`;
}

// ---------------------------------------------------------------------------
// Default clock + logger + publisher
// ---------------------------------------------------------------------------

const wallClock: InvestorReplayClock = {
  now: () => Date.now(),
  sleep: (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(0, ms));
    }),
};

const defaultInvestorLogger: InvestorReplayLogger = {
  info(message, ctx) {
    if (ctx) {
      // eslint-disable-next-line no-console
      console.log(message, ctx);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }
  },
  warn(message, ctx) {
    if (ctx) {
      // eslint-disable-next-line no-console
      console.warn(message, ctx);
    } else {
      // eslint-disable-next-line no-console
      console.warn(message);
    }
  },
};

/**
 * Build a Supabase realtime broadcast publisher for the investor demo. The
 * UI side subscribes to `supabase.channel('demo:investor:<scenarioKey>')`
 * and listens for `demo_event` broadcasts.
 *
 * Best-effort: failures are reported via the optional logger but never
 * propagate, since the demo_events table updates serve as a polling
 * fallback path.
 */
export function createSupabaseRealtimePublisher(
  supabase: SupabaseClient,
  options: { scenarioKey: string; logger?: InvestorReplayLogger } = {
    scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key,
  },
): InvestorReplayPublisher {
  const channelName = `demo:investor:${options.scenarioKey}`;
  const logger = options.logger ?? defaultInvestorLogger;

  const channelFactory = (
    supabase as unknown as {
      channel?: (name: string) => {
        send(args: {
          type: string;
          event: string;
          payload: unknown;
        }): Promise<unknown> | unknown;
      };
    }
  ).channel;

  if (typeof channelFactory !== "function") {
    return { async publish() {} };
  }

  const channel = channelFactory.call(supabase, channelName);

  return {
    async publish(event: InvestorDemoReplayEvent): Promise<void> {
      try {
        await Promise.resolve(
          channel.send({
            type: "broadcast",
            event: "demo_event",
            payload: event,
          }),
        );
      } catch (err) {
        logger.warn("[demo:replay] realtime broadcast failed", {
          event_type: event.event_type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

const noopPublisher: InvestorReplayPublisher = { async publish() {} };

// ---------------------------------------------------------------------------
// Engine implementation
// ---------------------------------------------------------------------------

interface RuntimeContext {
  supabase: SupabaseClient;
  logger: InvestorReplayLogger;
  clock: InvestorReplayClock;
  publisher: InvestorReplayPublisher;
  scenarioKey: string;
  speed: number;
  instant: boolean;
  onEvent?: (event: InvestorDemoReplayEvent) => void;
  onStateChange?: (state: InvestorDemoReplayState) => void;
}

interface ReplayMutableState {
  state: InvestorDemoReplayState;
  stopRequested: boolean;
  pauseStartedAt: number | null;
  pausedDurationMs: number;
  resumeWaiters: Array<() => void>;
  errors: string[];
  events: InvestorDemoReplayEvent[];
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(err);
}

async function loadScenarioEvents(
  supabase: SupabaseClient,
  scenarioKey: string,
): Promise<{ events: DemoEventRow[]; error: string | null }> {
  try {
    const res = (await supabase
      .from("demo_events")
      .select("*")
      .eq("scenario_key", scenarioKey)
      .order("event_order", { ascending: true })) as {
      data: DemoEventRow[] | null;
      error: { message: string } | null;
    };
    if (res.error) {
      return { events: [], error: res.error.message };
    }
    return { events: res.data ?? [], error: null };
  } catch (err) {
    return { events: [], error: describe(err) };
  }
}

async function setScenarioStatus(
  ctx: RuntimeContext,
  status: "ready" | "running" | "completed" | "archived",
): Promise<void> {
  try {
    const res = (await ctx.supabase
      .from("demo_scenarios")
      .update({ status })
      .eq("scenario_key", ctx.scenarioKey)) as {
      error: { message: string } | null;
    };
    if (res.error) {
      ctx.logger.warn("[demo:replay] failed to update scenario status", {
        status,
        error: res.error.message,
      });
    }
  } catch (err) {
    ctx.logger.warn("[demo:replay] failed to update scenario status", {
      status,
      error: describe(err),
    });
  }
}

async function applyAssetTransition(
  ctx: RuntimeContext,
  eventType: string,
): Promise<void> {
  const transitions = ASSET_TRANSITIONS.filter(
    (t) => t.event_type === eventType,
  );
  for (const t of transitions) {
    try {
      const res = (await ctx.supabase
        .from("demo_assets")
        .update({ status: t.status })
        .eq("scenario_key", ctx.scenarioKey)
        .eq("asset_name", t.asset_name)) as {
        error: { message: string } | null;
      };
      if (res.error) {
        ctx.logger.warn("[demo:replay] asset transition failed", {
          asset: t.asset_name,
          status: t.status,
          error: res.error.message,
        });
      }
    } catch (err) {
      ctx.logger.warn("[demo:replay] asset transition failed", {
        asset: t.asset_name,
        status: t.status,
        error: describe(err),
      });
    }
  }
}

async function applyActionTransition(
  ctx: RuntimeContext,
  eventType: string,
  emittedAtIso: string,
): Promise<void> {
  const transitions = ACTION_TRANSITIONS.filter(
    (t) => t.event_type === eventType,
  );
  for (const t of transitions) {
    const patch: Record<string, unknown> = { ...t.patch };
    if ("use_now_for_executed_at" in patch) {
      delete patch.use_now_for_executed_at;
      patch.executed_at = emittedAtIso;
    }
    try {
      const res = (await ctx.supabase
        .from("demo_actions")
        .update(patch)
        .eq("scenario_key", ctx.scenarioKey)
        .eq("action_type", t.action_type)) as {
        error: { message: string } | null;
      };
      if (res.error) {
        ctx.logger.warn("[demo:replay] action transition failed", {
          action_type: t.action_type,
          patch,
          error: res.error.message,
        });
      }
    } catch (err) {
      ctx.logger.warn("[demo:replay] action transition failed", {
        action_type: t.action_type,
        patch,
        error: describe(err),
      });
    }
  }
}

async function flushEventEmitted(
  ctx: RuntimeContext,
  eventOrder: number,
  emittedAtIso: string,
): Promise<void> {
  try {
    const res = (await ctx.supabase
      .from("demo_events")
      .update({ status: "emitted", emitted_at: emittedAtIso })
      .eq("scenario_key", ctx.scenarioKey)
      .eq("event_order", eventOrder)) as {
      error: { message: string } | null;
    };
    if (res.error) {
      ctx.logger.warn("[demo:replay] failed to mark event emitted", {
        event_order: eventOrder,
        error: res.error.message,
      });
    }
  } catch (err) {
    ctx.logger.warn("[demo:replay] failed to mark event emitted", {
      event_order: eventOrder,
      error: describe(err),
    });
  }
}

function buildEmittedEvent(
  row: DemoEventRow,
  emittedAtIso: string,
): InvestorDemoReplayEvent {
  return {
    scenario_key: row.scenario_key,
    event_order: row.event_order,
    offset_seconds: row.offset_seconds,
    event_type: row.event_type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    agent_name: row.agent_name,
    payload: row.payload ?? {},
    emitted_at: emittedAtIso,
    spoken_summary: getSpokenSummary(row.event_type, row.title),
  };
}

/**
 * Start an investor-demo replay against a seeded scenario.
 *
 * The returned handle exposes pause / resume / stop and a completion promise
 * resolving once the replay terminates. The function returns synchronously
 * with the handle; the actual run executes in a detached promise.
 */
export function startInvestorDemoReplay(
  options: InvestorReplayOptions = {},
  supabase?: SupabaseClient,
): InvestorReplayHandle {
  const speed = options.speedMultiplier ?? 1;
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(
      `[demoReplayEngine] invalid speedMultiplier: ${speed}`,
    );
  }

  const scenarioKey = options.scenarioKey ?? INVESTOR_DEMO_SCENARIO.scenario_key;
  const logger = options.logger ?? defaultInvestorLogger;
  const clock = options.clock ?? wallClock;
  const sb = supabase ?? getSupabaseAdminClient();
  const publisher =
    options.publisher === null
      ? noopPublisher
      : options.publisher ?? createSupabaseRealtimePublisher(sb, { scenarioKey, logger });

  const ctx: RuntimeContext = {
    supabase: sb,
    logger,
    clock,
    publisher,
    scenarioKey,
    speed,
    instant: options.instant === true,
    onEvent: options.onEvent,
    onStateChange: options.onStateChange,
  };

  const mut: ReplayMutableState = {
    state: "idle",
    stopRequested: false,
    pauseStartedAt: null,
    pausedDurationMs: 0,
    resumeWaiters: [],
    errors: [],
    events: [],
  };

  function setState(next: InvestorDemoReplayState): void {
    mut.state = next;
    ctx.onStateChange?.(next);
  }

  function elapsedMs(): number {
    const ref = mut.pauseStartedAt ?? clock.now();
    return ref - startMs - mut.pausedDurationMs;
  }

  let startMs = 0;

  async function awaitResumeIfPaused(): Promise<void> {
    if (mut.state !== "paused") return;
    await new Promise<void>((resolve) => {
      mut.resumeWaiters.push(resolve);
    });
  }

  async function emit(row: DemoEventRow): Promise<void> {
    const emittedAtIso = new Date(clock.now()).toISOString();
    const ev = buildEmittedEvent(row, emittedAtIso);
    mut.events.push(ev);

    await flushEventEmitted(ctx, row.event_order, emittedAtIso);
    await applyAssetTransition(ctx, row.event_type);
    await applyActionTransition(ctx, row.event_type, emittedAtIso);

    try {
      await ctx.publisher.publish(ev);
    } catch (err) {
      logger.warn("[demo:replay] publisher rejected", {
        event_type: row.event_type,
        error: describe(err),
      });
    }

    ctx.onEvent?.(ev);

    logger.info(
      `[demo:replay] +${row.offset_seconds}s — ${row.event_type}: ${row.title}`,
      {
        scenario_key: ctx.scenarioKey,
        event_order: row.event_order,
        agent_name: row.agent_name,
      },
    );
  }

  const completion = (async (): Promise<InvestorReplayResult> => {
    setState("running");

    const { events: rows, error: loadError } = await loadScenarioEvents(
      sb,
      scenarioKey,
    );
    if (loadError) {
      mut.errors.push(`load_events: ${loadError}`);
      setState("failed");
      return buildResult();
    }
    if (rows.length === 0) {
      mut.errors.push(
        `load_events: no demo_events found for scenario_key=${scenarioKey}. Run \`npm run demo:seed\` first.`,
      );
      setState("failed");
      return buildResult();
    }

    await setScenarioStatus(ctx, "running");
    startMs = clock.now();

    for (const row of rows) {
      if (mut.stopRequested) break;

      const targetMs = (row.offset_seconds * 1000) / ctx.speed;

      while (!ctx.instant) {
        if (mut.stopRequested) break;
        if (mut.state === "paused") {
          await awaitResumeIfPaused();
          if (mut.stopRequested) break;
          continue;
        }
        const remaining = targetMs - elapsedMs();
        if (remaining <= 0) break;
        const chunk = Math.min(remaining, 250);
        await clock.sleep(chunk);
      }

      if (mut.stopRequested) break;
      if (mut.state === "paused") {
        await awaitResumeIfPaused();
        if (mut.stopRequested) break;
      }

      try {
        await emit(row);
      } catch (err) {
        const msg = `emit_event(event_order=${row.event_order}): ${describe(err)}`;
        mut.errors.push(msg);
        logger.warn("[demo:replay] emit failed", {
          event_order: row.event_order,
          error: describe(err),
        });
      }
    }

    if (mut.stopRequested) {
      setState("stopped");
    } else {
      await setScenarioStatus(ctx, "completed");
      setState("completed");
    }

    return buildResult();
  })();

  function buildResult(): InvestorReplayResult {
    return {
      ok: mut.errors.length === 0 && mut.state === "completed",
      scenarioKey,
      finalState: mut.state,
      emittedEventCount: mut.events.length,
      events: mut.events,
      errors: mut.errors,
    };
  }

  return {
    scenarioKey,
    state: () => mut.state,
    pause(): void {
      if (mut.state !== "running") return;
      setState("paused");
      mut.pauseStartedAt = clock.now();
    },
    resume(): void {
      if (mut.state !== "paused") return;
      if (mut.pauseStartedAt !== null) {
        mut.pausedDurationMs += clock.now() - mut.pauseStartedAt;
        mut.pauseStartedAt = null;
      }
      setState("running");
      const waiters = mut.resumeWaiters.splice(0);
      for (const w of waiters) w();
    },
    stop(): void {
      mut.stopRequested = true;
      const waiters = mut.resumeWaiters.splice(0);
      for (const w of waiters) w();
    },
    completion,
  };
}

/** Convenience: run an investor demo and await its completion. */
export async function runInvestorDemoReplay(
  options: InvestorReplayOptions = {},
  supabase?: SupabaseClient,
): Promise<InvestorReplayResult> {
  return startInvestorDemoReplay(options, supabase).completion;
}
