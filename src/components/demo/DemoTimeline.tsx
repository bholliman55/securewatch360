"use client";

/**
 * DemoTimeline — chronological list of every scenario event with its
 * current emission status.
 *
 * Each row shows: timestamp, agent, severity, event title, short
 * explanation, status. Pending events are shown in a subdued tone so the
 * audience can see what is *coming next*; emitted events fade in with a
 * single short transition (no excessive animation).
 */

import type { DemoEventRow } from "@/demo/investorMode";

export interface DemoTimelineProps {
  events: ReadonlyArray<DemoEventRow>;
}

export function DemoTimeline({ events }: DemoTimelineProps): React.JSX.Element {
  const emittedCount = events.filter((e) => e.status === "emitted").length;
  return (
    <section
      aria-labelledby="demo-timeline-title"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(41,182,246,0.2)",
        background: "#0d1e33",
        boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid rgba(176,196,222,0.12)",
          padding: "0.85rem 1.25rem",
          display: "flex",
          alignItems: "baseline",
          gap: "0.75rem",
        }}
      >
        <h2
          id="demo-timeline-title"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 600,
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8ab4d4",
            margin: 0,
          }}
        >
          Live Timeline
        </h2>
        <p style={{ fontSize: "0.7rem", color: "#8ab4d4", margin: 0 }}>
          {events.length} events ·{" "}
          <span style={{ color: emittedCount > 0 ? "#22c55e" : "#8ab4d4" }}>
            {emittedCount} emitted
          </span>
        </p>
      </header>
      <ol style={{ maxHeight: 420, overflowY: "auto" }}>
        {events.length === 0 && (
          <li style={{ padding: "1.25rem", fontSize: "0.82rem", color: "#8ab4d4", fontStyle: "italic" }}>
            No events seeded yet. Click <span style={{ fontWeight: 600, color: "#29b6f6" }}>Seed Demo</span> to load the scenario.
          </li>
        )}
        {events.map((event) => (
          <TimelineRow key={event.id} event={event} />
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<
  DemoEventRow["severity"],
  { bg: string; color: string; border: string }
> = {
  info: { bg: "rgba(176,196,222,0.08)", color: "#8ab4d4", border: "rgba(176,196,222,0.2)" },
  low: { bg: "rgba(41,182,246,0.08)", color: "#29b6f6", border: "rgba(41,182,246,0.25)" },
  medium: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  high: { bg: "rgba(251,146,60,0.1)", color: "#fb923c", border: "rgba(251,146,60,0.3)" },
  critical: { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
};

const STATUS_STYLE: Record<DemoEventRow["status"], { color: string; extra?: string }> = {
  pending: { color: "#8ab4d4" },
  emitted: { color: "#22c55e" },
  skipped: { color: "#8ab4d4", extra: "line-through" },
};

function TimelineRow({ event }: { event: DemoEventRow }): React.JSX.Element {
  const isPending = event.status === "pending";
  const timestamp = formatTime(event.emitted_at, event.offset_seconds);
  const sev = SEVERITY_STYLE[event.severity];
  const sta = STATUS_STYLE[event.status];
  return (
    <li
      style={{
        display: "flex",
        gap: "1rem",
        padding: "0.7rem 1.25rem",
        borderBottom: "1px solid rgba(176,196,222,0.08)",
        opacity: isPending ? 0.45 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      <div style={{ width: 72, flexShrink: 0 }} aria-hidden>
        <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#8ab4d4" }}>
          {timestamp}
        </div>
        <div style={{ marginTop: 2, fontSize: "0.62rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "#8ab4d4", opacity: 0.7 }}>
          T+{event.offset_seconds}s
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 4,
              border: `1px solid ${sev.border}`,
              background: sev.bg,
              padding: "0.1rem 0.45rem",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: sev.color,
            }}
          >
            {event.severity}
          </span>
          {event.agent_name && (
            <span style={{ fontSize: "0.72rem", color: "#8ab4d4" }}>{event.agent_name}</span>
          )}
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: sta.color,
              textDecoration: sta.extra,
            }}
          >
            {event.status}
          </span>
        </div>
        <h3 style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>
          {event.title}
        </h3>
        <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#8ab4d4", lineHeight: 1.4 }}>
          {event.description}
        </p>
      </div>
    </li>
  );
}

function formatTime(emittedAt: string | null, offsetSeconds: number): string {
  if (emittedAt) {
    const date = new Date(emittedAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
  }
  // Pending: show offset as a relative anchor
  const m = Math.floor(offsetSeconds / 60);
  const s = offsetSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
