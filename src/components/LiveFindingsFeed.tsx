"use client";

import { useState } from "react";
import { useLiveFindings } from "@/hooks/useLiveFindings";

interface FeedEntry {
  id: string;
  type: "finding" | "asset" | "intel_event";
  title: string;
  severity?: string;
  timestamp: Date;
}

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-700",
};

export function LiveFindingsFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  const push = (type: FeedEntry["type"], payload: Record<string, unknown>) => {
    const entry: FeedEntry = {
      id: crypto.randomUUID(),
      type,
      title:
        type === "finding"
          ? String(payload.title ?? "New finding")
          : type === "asset"
          ? String(payload.asset_value ?? "New asset discovered")
          : String(payload.event_type ?? "New intelligence event"),
      severity: payload.severity as string | undefined,
      timestamp: new Date(),
    };
    setEntries((prev) => [entry, ...prev].slice(0, 20));
  };

  const { connected } = useLiveFindings({
    onFinding: (p) => push("finding", p),
    onAsset: (p) => push("asset", p),
    onIntelEvent: (p) => push("intel_event", p),
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-sm font-semibold text-gray-700">Live Events</h3>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-gray-300"}`} />
          {connected ? "Connected" : "Reconnecting…"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">Waiting for live events…</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs"
            >
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  e.severity
                    ? (SEVERITY_CLASSES[e.severity] ?? "bg-gray-100 text-gray-500")
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {e.type === "finding" ? (e.severity ?? "finding") : e.type.replace("_", " ")}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-700">{e.title}</span>
              <span className="shrink-0 tabular-nums text-gray-400">
                {e.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
