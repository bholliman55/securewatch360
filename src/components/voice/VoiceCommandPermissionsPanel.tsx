/**
 * VoiceCommandPermissionsPanel — explains the four guardrails the voice
 * gateway enforces before any command is routed.
 *
 * Mirrors `evaluateVoicePolicy` exactly: read-only commands run immediately,
 * low-risk and high-risk commands need a role / confirmation step, and
 * destructive commands require an admin role plus an explicit verbal
 * confirmation. Every disposition is mirrored to `audit_logs` and the
 * dedicated `voice_audit_events` table.
 *
 * Pure presentation; safe to render server-side.
 */

import type { ReactNode } from "react";

import type { CommandSafetyLevel } from "@/server/voice/types";

interface Guardrail {
  id: CommandSafetyLevel | "AUDIT";
  label: string;
  description: string;
  badge: string;
  badgeClass: string;
}

const GUARDRAILS: ReadonlyArray<Guardrail> = [
  {
    id: "READ_ONLY",
    label: "Read-only commands run immediately",
    description:
      "Lookups (findings, posture, risk summaries) execute the same turn — the voice agent speaks the answer back.",
    badge: "always allowed",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "LOW_RISK_ACTION",
    label: "Low-risk actions need an analyst role",
    description:
      "Queueing scans or report generation is dispatched without confirmation but only for analyst-or-above roles.",
    badge: "analyst+",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    id: "HIGH_RISK_ACTION",
    label: "Risky commands require explicit confirmation",
    description:
      "Incident response and ticket creation pause for a verbal challenge. The operator must repeat the canonical confirmation phrase within five minutes.",
    badge: "needs confirmation",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    id: "DESTRUCTIVE_ACTION",
    label: "Destructive commands require admin + confirmation",
    description:
      "Endpoint isolation and account disable demand both an admin role and a phrase-match confirmation. Non-admins are denied even with the phrase.",
    badge: "admin only",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    id: "AUDIT",
    label: "Every voice action is audited",
    description:
      "Two rows are written for every command — one on receipt, one on resolution — to both audit_logs and voice_audit_events. Confirmations log requested / accepted / rejected / expired.",
    badge: "no exceptions",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
];

export interface VoiceCommandPermissionsPanelProps {
  title?: ReactNode;
}

export function VoiceCommandPermissionsPanel({
  title = "Guardrails",
}: VoiceCommandPermissionsPanelProps) {
  return (
    <section
      aria-labelledby="voice-guardrails-title"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          id="voice-guardrails-title"
          className="text-lg font-semibold text-gray-900"
        >
          {title}
        </h2>
        <p className="text-xs text-gray-500">
          Enforced server-side by the voice policy guard. The voice front-end
          never decides on its own.
        </p>
      </header>

      <ul className="mt-4 space-y-3">
        {GUARDRAILS.map((g) => (
          <li
            key={g.id}
            className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3"
          >
            <CheckIcon />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{g.label}</p>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${g.badgeClass}`}
                >
                  {g.badge}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{g.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
