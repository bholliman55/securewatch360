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

      <span
        aria-hidden
        style={{ width: 1, height: 20, background: "rgba(41,182,246,0.2)", display: "inline-block", margin: "0 4px" }}
      />

      <PrimaryButton
        onClick={onStart}
        disabled={disabled || !canStart}
        tone="primary"
      >
        ▶ Start Simulation
      </PrimaryButton>

      <PrimaryButton
        onClick={onRunFast}
        disabled={disabled || !canStart}
        tone="primary-soft"
      >
        ⚡ Run Fast
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

      <span
        aria-hidden
        style={{ width: 1, height: 20, background: "rgba(41,182,246,0.2)", display: "inline-block", margin: "0 4px" }}
      />

      <PrimaryButton onClick={onGenerateReport} disabled={disabled} tone="neutral">
        Generate Report
      </PrimaryButton>

      <div
        className="ml-auto flex items-center gap-3"
        style={{ fontSize: "0.75rem", color: "#8ab4d4" }}
      >
        {busy && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#29b6f6",
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
            <span style={{ color: "#29b6f6" }}>{busy}…</span>
          </span>
        )}
        {!busy && replayState && (
          <span>
            Replay:{" "}
            <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{replayState}</span>
          </span>
        )}
        {lastError && (
          <span
            style={{
              borderRadius: 6,
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.1)",
              padding: "0.15rem 0.5rem",
              color: "#f87171",
              fontSize: "0.72rem",
            }}
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

const TONE_STYLE: Record<
  PrimaryButtonProps["tone"],
  { bg: string; color: string; border: string; disabledBg: string; disabledColor: string }
> = {
  neutral: {
    bg: "rgba(176,196,222,0.08)",
    color: "#b0c4de",
    border: "rgba(176,196,222,0.2)",
    disabledBg: "rgba(176,196,222,0.04)",
    disabledColor: "rgba(176,196,222,0.3)",
  },
  primary: {
    bg: "#1565c0",
    color: "#fff",
    border: "#1e88e5",
    disabledBg: "rgba(21,101,192,0.3)",
    disabledColor: "rgba(255,255,255,0.35)",
  },
  "primary-soft": {
    bg: "rgba(0,229,255,0.08)",
    color: "#00e5ff",
    border: "rgba(0,229,255,0.35)",
    disabledBg: "rgba(0,229,255,0.03)",
    disabledColor: "rgba(0,229,255,0.3)",
  },
  warn: {
    bg: "rgba(251,191,36,0.1)",
    color: "#fbbf24",
    border: "rgba(251,191,36,0.35)",
    disabledBg: "rgba(251,191,36,0.04)",
    disabledColor: "rgba(251,191,36,0.3)",
  },
  danger: {
    bg: "rgba(248,113,113,0.1)",
    color: "#f87171",
    border: "rgba(248,113,113,0.35)",
    disabledBg: "rgba(248,113,113,0.04)",
    disabledColor: "rgba(248,113,113,0.3)",
  },
};

function PrimaryButton({
  onClick,
  disabled,
  tone,
  children,
}: PrimaryButtonProps): React.JSX.Element {
  const s = TONE_STYLE[tone];
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        borderRadius: 7,
        border: `1px solid ${disabled ? "rgba(176,196,222,0.12)" : s.border}`,
        background: disabled ? s.disabledBg : s.bg,
        color: disabled ? s.disabledColor : s.color,
        padding: "0.4rem 0.85rem",
        fontSize: "0.8rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        letterSpacing: "0.015em",
        boxShadow: !disabled && tone === "primary" ? "0 2px 12px rgba(21,101,192,0.35)" : "none",
      }}
    >
      {children}
    </button>
  );
}
