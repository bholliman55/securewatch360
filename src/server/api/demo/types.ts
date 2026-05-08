/**
 * Shared types for the `/api/demo/*` service layer.
 *
 * The service modules in this directory each export a single async handler
 * that takes a typed input (and optionally a Supabase client + a singleton
 * replay store reference, both for testability) and returns a typed
 * result. Next.js route handlers under `src/app/api/demo/*` are thin
 * wrappers — they parse the request, call the service, and serialize the
 * result.
 *
 * Every result type carries an explicit `ok: boolean` and `errors:
 * string[]` — none of these endpoints throw. Failures are reported as
 * `ok: false` with operator-readable messages so the UI can show them
 * verbatim.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DemoActionRow,
  DemoAssetRow,
  DemoEventRow,
  DemoMetricRow,
  DemoReportRow,
  DemoScenarioRow,
  InvestorDemoReplayState,
  ResetInvestorDemoResult,
  SeedInvestorDemoResult,
} from "@/demo/investorMode";

// ---------------------------------------------------------------------------
// Common deps
// ---------------------------------------------------------------------------

/**
 * Optional dependency injection passed to every service handler.
 *
 * Tests use these to swap in an in-memory Supabase facade and a
 * deterministic replay-store stub. Production callers leave them undefined
 * and the handlers fall back to the real admin Supabase client + the
 * module-level singleton in `src/server/demo/investorReplayStore.ts`.
 */
export interface DemoServiceDeps {
  supabase?: SupabaseClient;
  replayStore?: ReplayStoreLike;
}

/** Subset of the singleton replay store used by the service layer. */
export interface ReplayStoreLike {
  startReplay(options: {
    speedMultiplier?: number;
    instant?: boolean;
  }): { handle: { scenarioKey: string; state(): InvestorDemoReplayState }; reused: boolean };
  pauseActiveReplay(): { ok: boolean; reason?: string };
  resumeActiveReplay(): { ok: boolean; reason?: string };
  stopActiveReplay(): { ok: boolean; reason?: string };
  clearActiveReplay(): void;
  getReplayStatus(): {
    hasActive: boolean;
    state: InvestorDemoReplayState | null;
    scenarioKey: string | null;
    speedMultiplier: number | null;
    startedAt: string | null;
    emittedEventCount: number | null;
  };
}

// ---------------------------------------------------------------------------
// Result envelopes
// ---------------------------------------------------------------------------

export interface SeedResult {
  ok: boolean;
  scenarioKey: string;
  scenarioSummary: {
    name: string;
    description: string;
    client: string;
    msp: string;
    asset_count: number;
    event_count: number;
    metric_count: number;
  };
  counts: SeedInvestorDemoResult["counts"];
  errors: string[];
}

export interface ResetResult {
  ok: boolean;
  scenarioKey: string;
  reset: ResetInvestorDemoResult["reset"];
  message: string;
  errors: string[];
}

export interface StartInput {
  speedMultiplier?: number;
  instant?: boolean;
}

export interface StartResult {
  ok: boolean;
  scenarioKey: string;
  state: InvestorDemoReplayState;
  speedMultiplier: number;
  instant: boolean;
  reused: boolean;
  errors: string[];
}

export interface StatusResult {
  ok: boolean;
  scenarioKey: string;
  scenarioStatus: DemoScenarioRow["status"] | "unseeded";
  replay: ReturnType<ReplayStoreLike["getReplayStatus"]>;
  currentEvent: DemoEventRow | null;
  /** Quick rollup so the UI doesn't have to crawl the events array. */
  emittedCount: number;
  totalCount: number;
  metrics: DemoMetricRow[];
  errors: string[];
}

export interface EventsResult {
  ok: boolean;
  scenarioKey: string;
  events: DemoEventRow[];
  errors: string[];
}

export interface ReportResult {
  ok: boolean;
  scenarioKey: string;
  report: DemoReportRow | null;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Voice command
// ---------------------------------------------------------------------------

export const VOICE_INTENTS = [
  "summarize_threat",
  "explain_isolation",
  "generate_report",
  "describe_compliance",
  "unknown",
] as const;

export type VoiceIntent = (typeof VOICE_INTENTS)[number];

export interface VoiceCommandInput {
  commandText: string;
}

export interface VoiceActionResult {
  /** What kind of side-effect happened, if any. */
  type:
    | "narrate"
    | "explain_isolation"
    | "generate_report"
    | "describe_compliance"
    | "no_op";
  /** Operator-readable summary of what happened. */
  summary: string;
  /** Free-form structured payload for downstream consumers. */
  payload: Record<string, unknown>;
}

export interface VoiceCommandResult {
  ok: boolean;
  /** Echo of the trimmed input so logs can correlate. */
  commandText: string;
  /** Classified intent — `unknown` when no rule matches. */
  intent: VoiceIntent;
  /** The canonical example phrase that matched, if any. */
  matchedExample: string | null;
  /** Short, calm, executive-friendly TTS line for the operator. */
  spokenSummary: string;
  /** What the gateway did about it (deterministic; never calls real APIs). */
  action: VoiceActionResult | null;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers re-exported for the route layer
// ---------------------------------------------------------------------------

export type {
  DemoActionRow,
  DemoAssetRow,
  DemoEventRow,
  DemoMetricRow,
  DemoReportRow,
  DemoScenarioRow,
  InvestorDemoReplayState,
};
