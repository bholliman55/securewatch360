/**
 * VoiceCommandCenter — landing surface that explains the SecureWatch360 voice
 * operating layer at a glance.
 *
 * The page is intentionally calm and informational. We do not embed a live
 * microphone here; the operator's actual voice surface lives on the analyst
 * console (see `src/components/nl/VoiceCommandPanel.tsx`). This page tells
 * customers and internal stakeholders what the voice layer *is*, how it
 * decides, and what guardrails apply — without resorting to animation,
 * mascots, or marketing fluff.
 *
 * Composition (mirrors the user-visible spec):
 *
 *   1. Voice status        — connection, active session, last command,
 *                             current action.
 *   2. Try saying          — five canonical example utterances.
 *   3. Pipeline timeline   — the seven gateway stages with per-stage status.
 *   4. Guardrails panel    — the four policy rules that govern execution.
 *
 * All sub-components are pure server components, so this page renders without
 * any client-side hydration unless a parent decides to feed it live data.
 */

import type { ReactNode } from "react";

import {
  DEFAULT_VOICE_EXAMPLES,
  VoiceCommandExamples,
  type VoiceCommandExample,
} from "./VoiceCommandExamples";
import { VoiceCommandPermissionsPanel } from "./VoiceCommandPermissionsPanel";
import {
  VoiceCommandTimeline,
  type VoiceTimelineStage,
} from "./VoiceCommandTimeline";
import type {
  CommandSafetyLevel,
  VoiceGatewayStatus,
  VoiceIntent,
} from "@/server/voice/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VoiceConnectionState {
  connected: boolean;
  /** Optional ElevenLabs agent id for display (last 6 chars surfaced). */
  agentId?: string;
  /** ISO timestamp of the most recent connectivity probe. */
  lastCheckedAt?: string;
}

export interface VoiceSessionState {
  active: boolean;
  conversationId?: string;
  startedAt?: string;
  channel?: "elevenlabs" | "elevenlabs-outbound" | "elevenlabs-outbound-dry-run";
}

export interface VoiceLastCommandState {
  transcript?: string;
  intent?: VoiceIntent;
  safetyLevel?: CommandSafetyLevel;
  status?: VoiceGatewayStatus;
  at?: string;
}

export interface VoiceCurrentAction {
  /** Short label of what's running right now (e.g. intent description). */
  label?: string;
  /** Optional spoken-response excerpt the operator most recently heard. */
  spokenResponse?: string;
}

export interface VoiceCommandCenterState {
  connection: VoiceConnectionState;
  session: VoiceSessionState;
  lastCommand?: VoiceLastCommandState;
  currentAction?: VoiceCurrentAction;
  /** Per-stage status for the pipeline timeline. */
  timeline?: ReadonlyArray<VoiceTimelineStage>;
}

export interface VoiceCommandCenterProps {
  state: VoiceCommandCenterState;
  /** Override the example list (e.g. tenant-tailored phrasing). */
  examples?: ReadonlyArray<VoiceCommandExample>;
  /** Optional title; default is "Voice Command Center". */
  title?: ReactNode;
  /** Optional subtitle / one-liner under the title. */
  subtitle?: ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function formatRelative(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
}

function maskAgentId(agentId: string | undefined): string | null {
  if (!agentId) return null;
  const trimmed = agentId.trim();
  if (trimmed.length <= 6) return trimmed;
  return `…${trimmed.slice(-6)}`;
}

const STATUS_BADGE_CLASS: Record<VoiceGatewayStatus, string> = {
  executed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  needs_confirmation: "bg-amber-50 text-amber-800 border-amber-200",
  needs_clarification: "bg-sky-50 text-sky-700 border-sky-200",
  denied: "bg-rose-50 text-rose-700 border-rose-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

// ---------------------------------------------------------------------------
// Voice status (Section 1)
// ---------------------------------------------------------------------------

function VoiceStatusCard({
  state,
}: {
  state: VoiceCommandCenterState;
}) {
  const { connection, session, lastCommand, currentAction } = state;
  const agentSuffix = maskAgentId(connection.agentId);
  const lastChecked = formatRelative(connection.lastCheckedAt);
  const sessionStarted = formatRelative(session.startedAt);
  const lastCommandWhen = formatRelative(lastCommand?.at);

  return (
    <section
      aria-labelledby="voice-status-title"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          id="voice-status-title"
          className="text-lg font-semibold text-gray-900"
        >
          Voice status
        </h2>
        <ConnectionPill connected={connection.connected} />
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCell
          label="ElevenLabs"
          value={connection.connected ? "Connected" : "Not connected"}
          hint={
            connection.connected
              ? agentSuffix
                ? `Agent ${agentSuffix}`
                : "Agent configured"
              : "Set ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID to enable."
          }
          tone={connection.connected ? "ok" : "warn"}
          footer={lastChecked ? `Checked ${lastChecked}` : undefined}
        />

        <StatusCell
          label="Active session"
          value={session.active ? "Live" : "Idle"}
          hint={
            session.active && session.conversationId
              ? truncateMiddle(session.conversationId, 14)
              : session.active
                ? "Conversation in flight"
                : "No active conversation"
          }
          tone={session.active ? "ok" : "neutral"}
          footer={
            session.active && sessionStarted
              ? `Started ${sessionStarted}`
              : session.channel
                ? `Channel ${session.channel}`
                : undefined
          }
        />

        <StatusCell
          label="Last command"
          value={lastCommand?.transcript ? `“${truncate(lastCommand.transcript, 64)}”` : "—"}
          hint={
            lastCommand?.intent
              ? `${lastCommand.intent}${lastCommand.safetyLevel ? ` · ${lastCommand.safetyLevel}` : ""}`
              : "No commands yet this session."
          }
          tone="neutral"
          footer={lastCommandWhen ?? undefined}
          rightSlot={
            lastCommand?.status ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[lastCommand.status]}`}
              >
                {lastCommand.status.replace(/_/g, " ")}
              </span>
            ) : null
          }
        />

        <StatusCell
          label="Current action"
          value={currentAction?.label ?? "Standing by"}
          hint={
            currentAction?.spokenResponse
              ? `“${truncate(currentAction.spokenResponse, 80)}”`
              : "The agent is waiting for the next utterance."
          }
          tone={currentAction?.label ? "active" : "neutral"}
        />
      </dl>
    </section>
  );
}

function ConnectionPill({ connected }: { connected: boolean }) {
  const cls = connected
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-gray-200 bg-gray-50 text-gray-500";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-gray-400"}`}
      />
      {connected ? "Online" : "Offline"}
    </span>
  );
}

interface StatusCellProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  footer?: string;
  tone?: "ok" | "warn" | "active" | "neutral";
  rightSlot?: ReactNode;
}

function StatusCell({
  label,
  value,
  hint,
  footer,
  tone = "neutral",
  rightSlot,
}: StatusCellProps) {
  const valueClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-800"
        : tone === "active"
          ? "text-sky-700"
          : "text-gray-900";

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {label}
        </dt>
        {rightSlot ?? null}
      </div>
      <dd className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</dd>
      {hint ? (
        <p className="mt-0.5 text-xs text-gray-600">{hint}</p>
      ) : null}
      {footer ? (
        <p className="mt-1 text-[11px] text-gray-400">{footer}</p>
      ) : null}
    </div>
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function truncateMiddle(value: string, max: number): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export function VoiceCommandCenter({
  state,
  examples = DEFAULT_VOICE_EXAMPLES,
  title = "Voice Command Center",
  subtitle = "SecureWatch360 listens, classifies, asks, and acts — with audit on every step.",
}: VoiceCommandCenterProps) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-gray-600">{subtitle}</p>
        ) : null}
        {state.connection.lastCheckedAt ? (
          <p className="text-xs text-gray-400">
            Status as of {formatTimestamp(state.connection.lastCheckedAt)}
          </p>
        ) : null}
      </header>

      <VoiceStatusCard state={state} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VoiceCommandExamples examples={examples} />
        <VoiceCommandPermissionsPanel />
      </div>

      <VoiceCommandTimeline
        stages={state.timeline}
        subtitle={
          state.lastCommand?.transcript
            ? `Last transcript: “${truncate(state.lastCommand.transcript, 96)}”`
            : "No commands yet — pipeline shown for reference."
        }
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Convenience: sensible empty state for static rendering / Storybook.
// ---------------------------------------------------------------------------

export const EMPTY_VOICE_COMMAND_CENTER_STATE: VoiceCommandCenterState = {
  connection: { connected: false },
  session: { active: false },
};
