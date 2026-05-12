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
  const panelStyle: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(41,182,246,0.2)",
    background: "#0d1e33",
    padding: "1rem 1.1rem",
    boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
  };
  const kicker: React.CSSProperties = {
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#8ab4d4",
  };
  return (
    <section aria-labelledby="voice-panel-title" style={panelStyle}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 id="voice-panel-title" style={{ ...kicker, margin: 0 }}>
          Voice Command Panel
        </h2>
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#22c55e",
          }}
        >
          ElevenLabs ready
        </span>
      </header>

      <div
        style={{
          marginTop: "0.85rem",
          borderRadius: 8,
          border: "1px solid rgba(0,229,255,0.2)",
          background: "rgba(0,229,255,0.05)",
          padding: "0.65rem 0.85rem",
        }}
      >
        <h3 style={{ ...kicker, margin: 0 }}>Latest Spoken Summary</h3>
        <p style={{ marginTop: "0.4rem", fontSize: "0.82rem", color: "#e2e8f0", lineHeight: 1.45 }}>
          {spokenSummary ?? "Voice surface idle. Spoken summaries appear here as events fire."}
        </p>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <h3 style={{ ...kicker, margin: 0, marginBottom: "0.55rem" }}>Try Saying</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {SUGGESTED_COMMANDS.map((cmd) => (
            <li
              key={cmd.label}
              style={{
                borderRadius: 7,
                border: "1px solid rgba(176,196,222,0.15)",
                background: "rgba(176,196,222,0.05)",
                padding: "0.5rem 0.7rem",
              }}
            >
              <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
                <span aria-hidden style={{ marginRight: 3, color: "#8ab4d4" }}>&ldquo;</span>
                {cmd.label}
                <span aria-hidden style={{ marginLeft: 3, color: "#8ab4d4" }}>&rdquo;</span>
              </p>
              <p style={{ marginTop: 2, fontSize: "0.7rem", color: "#8ab4d4" }}>{cmd.hint}</p>
            </li>
          ))}
        </ul>
      </div>

      <p style={{ marginTop: "0.85rem", fontSize: "0.68rem", color: "#8ab4d4", lineHeight: 1.45 }}>
        Voice integration is optional — the demo runs end-to-end with or
        without ElevenLabs configured. When connected, these commands are
        served by the analyst console&apos;s voice gateway.
      </p>
    </section>
  );
}
