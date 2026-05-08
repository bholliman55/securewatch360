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
  return (
    <section
      aria-labelledby="demo-timeline-title"
      className="rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <header className="border-b border-gray-100 px-5 py-4">
        <h2
          id="demo-timeline-title"
          className="text-base font-semibold text-gray-900"
        >
          Live timeline
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {events.length} events · {events.filter((e) => e.status === "emitted").length} emitted
        </p>
      </header>
      <ol className="divide-y divide-gray-100">
        {events.length === 0 && (
          <li className="px-5 py-6 text-sm text-gray-500">
            No events seeded yet. Click <span className="font-medium">Seed Demo</span> to load the scenario.
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

const SEVERITY_CLASS: Record<DemoEventRow["severity"], string> = {
  info: "bg-gray-50 text-gray-700 border-gray-200",
  low: "bg-sky-50 text-sky-700 border-sky-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-orange-50 text-orange-800 border-orange-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_CLASS: Record<DemoEventRow["status"], string> = {
  pending: "text-gray-400",
  emitted: "text-emerald-700",
  skipped: "text-gray-400 line-through",
};

function TimelineRow({ event }: { event: DemoEventRow }): React.JSX.Element {
  const isPending = event.status === "pending";
  const timestamp = formatTime(event.emitted_at, event.offset_seconds);
  return (
    <li
      className={`flex gap-4 px-5 py-3 transition-opacity ${
        isPending ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="w-20 shrink-0 text-xs text-gray-500" aria-hidden>
        <div className="font-mono">{timestamp}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">
          T+{event.offset_seconds}s
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_CLASS[event.severity]}`}
          >
            {event.severity}
          </span>
          {event.agent_name && (
            <span className="text-xs text-gray-600">{event.agent_name}</span>
          )}
          <span
            className={`ml-auto text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[event.status]}`}
          >
            {event.status}
          </span>
        </div>
        <h3 className="mt-1 text-sm font-medium text-gray-900">{event.title}</h3>
        <p className="mt-0.5 text-sm text-gray-600">{event.description}</p>
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
