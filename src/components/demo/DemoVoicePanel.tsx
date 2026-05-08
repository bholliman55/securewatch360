"use client";

/**
 * DemoVoicePanel — explains how the voice surface integrates with the
 * Investor Mode demo, lists suggested commands, and shows the most recent
 * spoken summary line that *would* be played through ElevenLabs.
 *
 * The component renders correctly even when ElevenLabs is not connected —
 * `spokenSummary` is purely informational text. There is no live audio
 * playback here; that integration is owned by the analyst console.
 */

export interface DemoVoicePanelProps {
  /** The most recent spoken-summary line for the operator/audience. */
  spokenSummary: string | null;
}

const SUGGESTED_COMMANDS: ReadonlyArray<{ label: string; hint: string }> = [
  {
    label: "SecureWatch, summarize the threat.",
    hint: "Concise readout of what the agents observed.",
  },
  {
    label: "SecureWatch, why did you recommend isolation?",
    hint: "Justification anchored in correlated signals.",
  },
  {
    label: "SecureWatch, generate the executive report.",
    hint: "Produces a leadership-ready narrative.",
  },
  {
    label: "SecureWatch, what is the compliance impact?",
    hint: "Maps the event to HIPAA / CMMC controls.",
  },
];

export function DemoVoicePanel({
  spokenSummary,
}: DemoVoicePanelProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="voice-panel-title"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-baseline justify-between">
        <h2 id="voice-panel-title" className="text-base font-semibold text-gray-900">
          Voice command panel
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          ElevenLabs ready
        </span>
      </header>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Latest spoken summary
        </h3>
        <p className="mt-1 text-sm text-gray-800">
          {spokenSummary ?? "Voice surface idle. Spoken summaries appear here as events fire."}
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Try saying
        </h3>
        <ul className="mt-2 space-y-2">
          {SUGGESTED_COMMANDS.map((cmd) => (
            <li
              key={cmd.label}
              className="rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <p className="text-sm font-medium text-gray-900">
                <span aria-hidden className="mr-1 text-gray-400">
                  &ldquo;
                </span>
                {cmd.label}
                <span aria-hidden className="ml-1 text-gray-400">
                  &rdquo;
                </span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{cmd.hint}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-[11px] leading-snug text-gray-500">
        Voice integration is optional — the demo runs end-to-end with or
        without ElevenLabs configured. When connected, these commands are
        served by the analyst console&apos;s voice gateway.
      </p>
    </section>
  );
}
