"use client";

/**
 * DemoControlPanel — buttons that drive the investor demo lifecycle.
 *
 * The five primary controls map to the user-facing spec:
 *   - Seed Demo            (idempotent fixture insert)
 *   - Reset Demo           (wipe per-run state)
 *   - Start Simulation     (1× speed)
 *   - Run Fast             (5× speed)
 *   - Generate Report      (writes a fresh executive report row)
 *
 * Pause / Resume / Stop are surfaced contextually based on replay state.
 * The panel is purely presentational; the parent shell wires every callback
 * to the appropriate POST handler.
 */

import type { InvestorDemoReplayState } from "@/demo/investorMode";

export interface DemoControlPanelProps {
  /** Label of the in-flight action, or null when idle. */
  busy: string | null;
  scenarioStatus: "ready" | "running" | "completed" | "archived";
  replayState: InvestorDemoReplayState | null;
  onSeed: () => void | Promise<unknown>;
  onReset: () => void | Promise<unknown>;
  onStart: () => void | Promise<unknown>;
  onRunFast: () => void | Promise<unknown>;
  onPause: () => void | Promise<unknown>;
  onResume: () => void | Promise<unknown>;
  onStop: () => void | Promise<unknown>;
  onGenerateReport: () => void | Promise<unknown>;
  lastError?: string | null;
}

export function DemoControlPanel({
  busy,
  scenarioStatus,
  replayState,
  onSeed,
  onReset,
  onStart,
  onRunFast,
  onPause,
  onResume,
  onStop,
  onGenerateReport,
  lastError,
}: DemoControlPanelProps): React.JSX.Element {
  const disabled = busy !== null;
  const isRunning = replayState === "running";
  const isPaused = replayState === "paused";
  const canStart = scenarioStatus !== "running" && !isRunning && !isPaused;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PrimaryButton onClick={onSeed} disabled={disabled} tone="neutral">
        Seed Demo
      </PrimaryButton>

      <PrimaryButton onClick={onReset} disabled={disabled} tone="neutral">
        Reset Demo
      </PrimaryButton>

      <span aria-hidden className="mx-1 h-6 w-px bg-gray-200" />

      <PrimaryButton
        onClick={onStart}
        disabled={disabled || !canStart}
        tone="primary"
      >
        Start Simulation
      </PrimaryButton>

      <PrimaryButton
        onClick={onRunFast}
        disabled={disabled || !canStart}
        tone="primary-soft"
      >
        Run Fast
      </PrimaryButton>

      {isRunning && (
        <PrimaryButton onClick={onPause} disabled={disabled} tone="warn">
          Pause
        </PrimaryButton>
      )}
      {isPaused && (
        <PrimaryButton onClick={onResume} disabled={disabled} tone="primary">
          Resume
        </PrimaryButton>
      )}
      {(isRunning || isPaused) && (
        <PrimaryButton onClick={onStop} disabled={disabled} tone="danger">
          Stop
        </PrimaryButton>
      )}

      <span aria-hidden className="mx-1 h-6 w-px bg-gray-200" />

      <PrimaryButton onClick={onGenerateReport} disabled={disabled} tone="neutral">
        Generate Report
      </PrimaryButton>

      <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
        {busy && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500"
            />
            <span>{busy}…</span>
          </span>
        )}
        {!busy && replayState && (
          <span>
            Replay: <span className="font-medium text-gray-700">{replayState}</span>
          </span>
        )}
        {lastError && (
          <span
            className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700"
            role="alert"
          >
            {lastError}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PrimaryButtonProps {
  onClick: () => void | Promise<unknown>;
  disabled?: boolean;
  tone: "neutral" | "primary" | "primary-soft" | "warn" | "danger";
  children: React.ReactNode;
}

const TONE_CLASS: Record<PrimaryButtonProps["tone"], string> = {
  neutral:
    "border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400",
  primary:
    "border-sky-700 bg-sky-700 text-white hover:bg-sky-800 disabled:bg-sky-300 disabled:border-sky-300",
  "primary-soft":
    "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:bg-sky-50/50 disabled:text-sky-300",
  warn:
    "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:bg-amber-50/50 disabled:text-amber-400",
  danger:
    "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-rose-50/50 disabled:text-rose-400",
};

function PrimaryButton({
  onClick,
  disabled,
  tone,
  children,
}: PrimaryButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed ${TONE_CLASS[tone]}`}
    >
      {children}
    </button>
  );
}
