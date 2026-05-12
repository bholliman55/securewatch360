/**
 * VoiceCommandExamples — read-only list of example utterances.
 *
 * Each example is annotated with the deterministic intent the SecureWatch360
 * voice classifier will produce and a one-line note explaining why it's safe
 * to demonstrate on a live tenant. Annotations are deliberately concise; the
 * timeline / guardrails panel carry the detailed explanation.
 *
 * The component is intentionally a pure server component (no `"use client"`)
 * so it renders inside any layout — analyst console, marketing surfaces, or
 * an internal training page — without pulling React runtime overhead.
 */

import type { ReactNode } from "react";

import type {
  CommandSafetyLevel,
  VoiceIntent,
} from "@/server/voice/types";

export interface VoiceCommandExample {
  /** Spoken transcript exactly as the operator would say it. */
  transcript: string;
  /** Intent the deterministic classifier will produce. */
  intent: VoiceIntent;
  /** Safety classification used by the policy guard. */
  safetyLevel: CommandSafetyLevel;
  /** One-line rationale the UI surfaces under each example. */
  note: string;
}

export const DEFAULT_VOICE_EXAMPLES: ReadonlyArray<VoiceCommandExample> = [
  {
    transcript: "Run an external scan for Acme Dental",
    intent: "RUN_EXTERNAL_SCAN",
    safetyLevel: "LOW_RISK_ACTION",
    note: "Kicks off Agent 1 + Agent 2. No state change beyond a queued scan.",
  },
  {
    transcript: "Show me critical findings",
    intent: "SHOW_CRITICAL_FINDINGS",
    safetyLevel: "READ_ONLY",
    note: "Read-only query against the latest findings. Spoken inline.",
  },
  {
    transcript: "Is Acme Dental CMMC ready?",
    intent: "CHECK_COMPLIANCE_STATUS",
    safetyLevel: "READ_ONLY",
    note: "Asks Agent 3 for the framework posture summary.",
  },
  {
    transcript: "Generate an executive report for Acme Dental",
    intent: "GENERATE_EXECUTIVE_REPORT",
    safetyLevel: "LOW_RISK_ACTION",
    note: "Queues the threat-digest workflow. Report ID returned for download.",
  },
  {
    transcript: "Start incident response for this alert",
    intent: "START_INCIDENT_RESPONSE",
    safetyLevel: "HIGH_RISK_ACTION",
    note: "Requires explicit verbal confirmation before the war room opens.",
  },
];

const SAFETY_BADGE_CLASS: Record<CommandSafetyLevel, string> = {
  READ_ONLY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOW_RISK_ACTION: "bg-sky-50 text-sky-700 border-sky-200",
  HIGH_RISK_ACTION: "bg-amber-50 text-amber-800 border-amber-200",
  DESTRUCTIVE_ACTION: "bg-rose-50 text-rose-700 border-rose-200",
};

const SAFETY_LABEL: Record<CommandSafetyLevel, string> = {
  READ_ONLY: "read-only",
  LOW_RISK_ACTION: "low-risk",
  HIGH_RISK_ACTION: "needs confirmation",
  DESTRUCTIVE_ACTION: "admin + confirmation",
};

export interface VoiceCommandExamplesProps {
  /** Override the default example list (e.g. tenant-specific phrasing). */
  examples?: ReadonlyArray<VoiceCommandExample>;
  /** Optional title; default is "Try saying". */
  title?: ReactNode;
}

export function VoiceCommandExamples({
  examples = DEFAULT_VOICE_EXAMPLES,
  title = "Try saying",
}: VoiceCommandExamplesProps) {
  return (
    <section
      aria-labelledby="voice-examples-title"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          id="voice-examples-title"
          className="text-lg font-semibold text-gray-900"
        >
          {title}
        </h2>
        <p className="text-xs text-gray-500">
          Phrasing is matched by the deterministic classifier — no LLM
          paraphrasing required.
        </p>
      </header>

      <ul className="mt-4 divide-y divide-gray-100">
        {examples.map((ex) => (
          <li
            key={ex.transcript}
            className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                <span className="text-gray-400">&ldquo;</span>
                {ex.transcript}
                <span className="text-gray-400">&rdquo;</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">{ex.note}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 sm:pt-0.5">
              <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-gray-600">
                {ex.intent}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${SAFETY_BADGE_CLASS[ex.safetyLevel]}`}
              >
                {SAFETY_LABEL[ex.safetyLevel]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
