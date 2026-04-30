"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TimelineEntry {
  id: string;
  action: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Incident {
  id: string;
  status: string;
  severity: string;
  title: string;
  created_at: string;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["contained"],
  contained: ["remediated"],
  remediated: ["validated"],
  validated: ["rejoined", "open"],
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  contained: "bg-yellow-100 text-yellow-800",
  remediated: "bg-blue-100 text-blue-700",
  validated: "bg-green-100 text-green-700",
  rejoined: "bg-gray-100 text-gray-600",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-600",
  medium: "text-yellow-600",
  low: "text-green-600",
};

function actionLabel(action: string, meta: Record<string, unknown>): string {
  if (action === "incident.note_added") return `Note: ${String(meta.note ?? "")}`;
  if (action === "incident.transition") return `Status → ${String(meta.to ?? "")}`;
  return action;
}

export function IncidentWarRoom({ incidentId }: { incidentId: string }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/incidents/${incidentId}/timeline`);
    if (!res.ok) return;
    const d = (await res.json()) as { incident: Incident; timeline: TimelineEntry[] };
    setIncident(d.incident);
    setTimeline(d.timeline);
    setLoading(false);
  }, [incidentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [timeline]);

  const postNote = async () => {
    if (!note.trim()) return;
    setPosting(true);
    await fetch(`/api/incidents/${incidentId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() }),
    });
    setNote("");
    setPosting(false);
    void load();
  };

  const transition = async (toStatus: string) => {
    setTransitioning(true);
    await fetch(`/api/incidents/${incidentId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: toStatus }),
    });
    setTransitioning(false);
    void load();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-100" />;
  if (!incident) return <p className="text-sm text-red-600">Incident not found.</p>;

  const nextStatuses = STATUS_TRANSITIONS[incident.status] ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className={`text-xs font-semibold uppercase ${SEVERITY_COLORS[incident.severity] ?? "text-gray-600"}`}>
            {incident.severity} severity
          </p>
          <h2 className="text-lg font-bold text-gray-900 mt-0.5">{incident.title}</h2>
          <p className="text-xs text-gray-400 mt-1">Opened {new Date(incident.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[incident.status] ?? "bg-gray-100 text-gray-600"}`}>
            {incident.status}
          </span>
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => void transition(s)}
              disabled={transitioning}
              className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              → {s}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
        ) : (
          timeline.map((entry) => (
            <div key={entry.id} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />
                <div className="flex-1 w-px bg-gray-200 my-1" />
              </div>
              <div className="pb-2">
                <p className="text-gray-700">{actionLabel(entry.action, entry.metadata)}</p>
                <p className="text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleString()}
                  {entry.actor_user_id && ` · ${entry.actor_user_id.slice(0, 8)}…`}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postNote(); } }}
          placeholder="Add a note to the timeline…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => void postNote()}
          disabled={posting || !note.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {posting ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}
