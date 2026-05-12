/**
 * Module-level singleton holding the *currently active* investor-demo replay
 * handle (if any). Used by the Next.js API routes under
 * `/api/demo/investor/*` so that a Start request from one HTTP request can
 * be paused / resumed / stopped by a subsequent request.
 *
 * Server-only. Do not import from the browser bundle.
 *
 * The store is intentionally simple — there is exactly one investor demo
 * scenario in the system, so a single global replay handle is enough. If we
 * ever support multiple concurrent demos, key this store by `scenarioKey`.
 */

import {
  startInvestorDemoReplay,
  type InvestorReplayHandle,
  type InvestorReplayOptions,
  type InvestorReplayResult,
  type InvestorDemoReplayState,
} from "@/demo/investorMode";

interface ActiveReplay {
  handle: InvestorReplayHandle;
  startedAt: number;
  speedMultiplier: number;
  /** Latest snapshot of the completion result once it resolves. */
  result: InvestorReplayResult | null;
}

let active: ActiveReplay | null = null;

/** Return the currently active replay, if any. */
export function getActiveReplay(): ActiveReplay | null {
  return active;
}

/**
 * Start a new replay if none is running. Returns the existing handle if a
 * replay is already in flight (idempotent on rapid clicks).
 */
export function startReplay(
  options: InvestorReplayOptions = {},
): { handle: InvestorReplayHandle; reused: boolean } {
  if (active && isLive(active.handle.state())) {
    return { handle: active.handle, reused: true };
  }

  const handle = startInvestorDemoReplay(options);
  const speedMultiplier = options.speedMultiplier ?? 1;
  const newActive: ActiveReplay = {
    handle,
    startedAt: Date.now(),
    speedMultiplier,
    result: null,
  };
  active = newActive;

  // Capture the final result once the replay terminates. Errors are caught so
  // a downstream rejection cannot crash the process.
  handle.completion
    .then((res) => {
      if (active && active.handle === handle) {
        active.result = res;
      }
    })
    .catch(() => {
      // logged inside the engine; nothing else to do here
    });

  return { handle, reused: false };
}

/** Pause the active replay (if running). No-op otherwise. */
export function pauseActiveReplay(): { ok: boolean; reason?: string } {
  if (!active) return { ok: false, reason: "no active replay" };
  const state = active.handle.state();
  if (state !== "running") return { ok: false, reason: `cannot pause from ${state}` };
  active.handle.pause();
  return { ok: true };
}

/** Resume the active replay (if paused). No-op otherwise. */
export function resumeActiveReplay(): { ok: boolean; reason?: string } {
  if (!active) return { ok: false, reason: "no active replay" };
  const state = active.handle.state();
  if (state !== "paused") return { ok: false, reason: `cannot resume from ${state}` };
  active.handle.resume();
  return { ok: true };
}

/** Stop the active replay. No-op if already terminated. */
export function stopActiveReplay(): { ok: boolean; reason?: string } {
  if (!active) return { ok: false, reason: "no active replay" };
  if (!isLive(active.handle.state())) {
    return { ok: false, reason: "replay already terminated" };
  }
  active.handle.stop();
  return { ok: true };
}

/**
 * Clear the singleton — only call this from the reset route after the demo
 * has been wiped. Forces any subsequent Start to begin fresh.
 */
export function clearActiveReplay(): void {
  if (active && isLive(active.handle.state())) {
    active.handle.stop();
  }
  active = null;
}

/** Snapshot of the current replay state (for GET /status). */
export interface ReplayStatusSnapshot {
  hasActive: boolean;
  state: InvestorDemoReplayState | null;
  scenarioKey: string | null;
  speedMultiplier: number | null;
  startedAt: string | null;
  emittedEventCount: number | null;
}

export function getReplayStatus(): ReplayStatusSnapshot {
  if (!active) {
    return {
      hasActive: false,
      state: null,
      scenarioKey: null,
      speedMultiplier: null,
      startedAt: null,
      emittedEventCount: null,
    };
  }
  return {
    hasActive: true,
    state: active.handle.state(),
    scenarioKey: active.handle.scenarioKey,
    speedMultiplier: active.speedMultiplier,
    startedAt: new Date(active.startedAt).toISOString(),
    emittedEventCount: active.result?.emittedEventCount ?? null,
  };
}

function isLive(state: InvestorDemoReplayState): boolean {
  return state === "idle" || state === "running" || state === "paused";
}
