"use client";

interface IntelEvent {
  id: string;
  event_type: string;
  severity: string;
  confidence: number | null;
  source_category: string | null;
  evidence_url: string | null;
  redacted_preview: string | null;
  first_seen: string | null;
}

interface OsintEventsTableProps {
  events: IntelEvent[];
  loading?: boolean;
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-gray-100 text-gray-600 border-gray-200",
};

export function OsintEventsTable({ events, loading }: OsintEventsTableProps) {
  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-400">Loading intelligence events…</div>;
  }
  if (events.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400">No intelligence events found.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["Severity", "Event Type", "Source", "Confidence", "Preview", "Evidence", "First Seen"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5">
                <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${SEVERITY_BADGE[e.severity] ?? SEVERITY_BADGE.LOW}`}>
                  {e.severity}
                </span>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">{e.event_type}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">{e.source_category ?? "—"}</td>
              <td className="px-4 py-2.5 text-gray-700 text-xs">
                {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
              </td>
              <td className="px-4 py-2.5 text-gray-600 text-xs max-w-xs truncate" title={e.redacted_preview ?? ""}>
                {e.redacted_preview ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-xs">
                {e.evidence_url ? (
                  <a href={e.evidence_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block max-w-[140px]">
                    View
                  </a>
                ) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                {e.first_seen ? new Date(e.first_seen).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
