"use client";

interface SeverityBreakdown {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

interface ExternalRiskSummaryProps {
  domain: string;
  totalAssets: number;
  totalEvents: number;
  severityBreakdown: SeverityBreakdown;
  scanId?: string;
}

const SEVERITY_STYLES: Record<keyof SeverityBreakdown, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-gray-100 text-gray-600 border-gray-200",
};

export function ExternalRiskSummary({
  domain,
  totalAssets,
  totalEvents,
  severityBreakdown,
  scanId,
}: ExternalRiskSummaryProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">External Risk Summary</h3>
          <p className="text-sm text-gray-500 mt-0.5">{domain}</p>
        </div>
        {scanId && <span className="text-xs text-gray-400 font-mono">{scanId.slice(0, 8)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-gray-100 rounded p-3">
          <p className="text-2xl font-bold text-gray-900">{totalAssets}</p>
          <p className="text-xs text-gray-500 mt-0.5">Assets Discovered</p>
        </div>
        <div className="border border-gray-100 rounded p-3">
          <p className="text-2xl font-bold text-gray-900">{totalEvents}</p>
          <p className="text-xs text-gray-500 mt-0.5">Intelligence Events</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
          <span
            key={sev}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium ${SEVERITY_STYLES[sev]}`}
          >
            {sev}
            <span className="font-bold">{severityBreakdown[sev]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
