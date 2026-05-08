/**
 * VoiceCommandTimeline — vertical, deterministic timeline of the seven stages
 * a SecureWatch360 voice command flows through.
 *
 * The stage list is a closed set so the UI mirrors the gateway pipeline 1:1:
 *
 *   1. transcript_received      — ElevenLabs handed us a transcript.
 *   2. intent_classified        — voiceIntentClassifier produced an intent.
 *   3. permission_checked       — voicePolicyGuard evaluated role + safety.
 *   4. confirmation_requested   — only when policy returned needs_confirmation.
 *   5. agent_started            — adapter dispatched (Inngest event or direct call).
 *   6. result_returned          — spoken response composed.
 *   7. audit_logged             — voice_audit_events + audit_logs row written.
 *
 * Stages can be `pending`, `in_progress`, `done`, `skipped`, or `failed`.
 * `skipped` is the right state for `confirmation_requested` on a read-only
 * command — the visual treatment makes that obvious without graying out the
 * surrounding stages.
 */

import type { ReactNode } from "react";

export type VoiceTimelineStageId =
  | "transcript_received"
  | "intent_classified"
  | "permission_checked"
  | "confirmation_requested"
  | "agent_started"
  | "result_returned"
  | "audit_logged";

export type VoiceTimelineStageStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped"
  | "failed";

export interface VoiceTimelineStage {
  id: VoiceTimelineStageId;
  status: VoiceTimelineStageStatus;
  /** Optional secondary line shown under the stage label. */
  detail?: string;
  /** Optional ISO timestamp; rendered as the locale time on the right side. */
  at?: string;
}

const STAGE_LABEL: Record<VoiceTimelineStageId, string> = {
  transcript_received: "Transcript received",
  intent_classified: "Intent classified",
  permission_checked: "Permission checked",
  confirmation_requested: "Confirmation requested",
  agent_started: "Agent started",
  result_returned: "Result returned",
  audit_logged: "Audit log written",
};

const STAGE_DEFAULT_DETAIL: Record<VoiceTimelineStageId, string> = {
  transcript_received:
    "ElevenLabs delivers the spoken transcript via webhook or tool call.",
  intent_classified:
    "Deterministic regex classifier maps the utterance to a closed intent set.",
  permission_checked:
    "Policy guard evaluates safety level, role, and classifier confidence.",
  confirmation_requested:
    "High-risk and destructive commands pause for a verbal challenge.",
  agent_started:
    "Adapter routes to the appropriate Inngest workflow or service call.",
  result_returned:
    "Spoken summary is composed; never contains URLs, keys, or tokens.",
  audit_logged:
    "Two rows recorded: one on receipt, one on resolution — across both audit surfaces.",
};

const STAGE_ORDER: ReadonlyArray<VoiceTimelineStageId> = [
  "transcript_received",
  "intent_classified",
  "permission_checked",
  "confirmation_requested",
  "agent_started",
  "result_returned",
  "audit_logged",
];

export interface VoiceCommandTimelineProps {
  /** Per-stage status. Missing stages default to `pending`. */
  stages?: ReadonlyArray<VoiceTimelineStage>;
  /** Optional title; default is "Pipeline". */
  title?: ReactNode;
  /** Optional secondary line under the title (e.g. last command transcript). */
  subtitle?: ReactNode;
}

const DEFAULT_STAGES: ReadonlyArray<VoiceTimelineStage> = STAGE_ORDER.map(
  (id) => ({ id, status: "pending" as const }),
);

function statusVisuals(status: VoiceTimelineStageStatus): {
  ring: string;
  dot: string;
  label: string;
  labelClass: string;
} {
  switch (status) {
    case "done":
      return {
        ring: "border-emerald-500",
        dot: "bg-emerald-500",
        label: "done",
        labelClass: "text-emerald-700",
      };
    case "in_progress":
      return {
        ring: "border-sky-500",
        dot: "bg-sky-500",
        label: "in progress",
        labelClass: "text-sky-700",
      };
    case "failed":
      return {
        ring: "border-rose-500",
        dot: "bg-rose-500",
        label: "failed",
        labelClass: "text-rose-700",
      };
    case "skipped":
      return {
        ring: "border-gray-300",
        dot: "bg-gray-300",
        label: "skipped",
        labelClass: "text-gray-500",
      };
    case "pending":
    default:
      return {
        ring: "border-gray-300",
        dot: "bg-white",
        label: "pending",
        labelClass: "text-gray-400",
      };
  }
}

function formatTime(at: string | undefined): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function VoiceCommandTimeline({
  stages,
  title = "Pipeline",
  subtitle,
}: VoiceCommandTimelineProps) {
  const merged = STAGE_ORDER.map((id) => {
    const provided = (stages ?? DEFAULT_STAGES).find((s) => s.id === id);
    return provided ?? { id, status: "pending" as const };
  });

  return (
    <section
      aria-labelledby="voice-timeline-title"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <header>
        <h2
          id="voice-timeline-title"
          className="text-lg font-semibold text-gray-900"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </header>

      <ol className="relative mt-5 space-y-4">
        {merged.map((stage, index) => {
          const visuals = statusVisuals(stage.status);
          const isLast = index === merged.length - 1;
          const time = formatTime(stage.at);
          const detail = stage.detail ?? STAGE_DEFAULT_DETAIL[stage.id];

          return (
            <li key={stage.id} className="relative flex gap-3">
              {/* Connector line */}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-4 h-[calc(100%-0.25rem)] w-px bg-gray-200"
                />
              ) : null}

              {/* Stage dot */}
              <span
                aria-hidden="true"
                className={`relative z-10 mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white ${visuals.ring}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${visuals.dot}`}
                />
              </span>

              {/* Stage body */}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {STAGE_LABEL[stage.id]}
                  </p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`font-medium uppercase tracking-wide ${visuals.labelClass}`}
                    >
                      {visuals.label}
                    </span>
                    {time ? (
                      <span className="font-mono text-gray-400">{time}</span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-gray-600">{detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
