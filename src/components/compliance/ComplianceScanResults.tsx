"use client";

import { useEffect, useState, useCallback } from "react";

type ComplianceStatus = "pass" | "fail" | "partial" | "unknown" | "evidence_missing";

type ResultRow = {
  id: string;
  scan_run_id: string;
  framework: string;
  control_id: string;
  control_name: string;
  status: ComplianceStatus;
  evidence: Record<string, unknown>;
  gap: string | null;
  recommended_action: string | null;
  severity: string;
  created_at: string;
};

type Summary = {
  totalEvaluated: number;
  readinessPercent: number | null;
  pass: number;
  fail: number;
  partial: number;
  unknown: number;
  evidence_missing: number;
};

type ApiResponse = {
  ok: boolean;
  summary: Summary;
  topGaps: ResultRow[];
  recentRuns: { scanRunId: string; framework: string; assessedAt: string }[];
  results: ResultRow[];
  error?: string;
};

const STATUS_STYLES: Record<ComplianceStatus, string> = {
  pass: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  unknown: "bg-gray-100 text-gray-700",
  evidence_missing: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  partial: "Partial",
  unknown: "Unknown",
  evidence_missing: "No Evidence",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
  info: "bg-gray-300",
};

const FRAMEWORKS = [
  { code: "", name: "All frameworks" },
  { code: "CMMC_L1", name: "CMMC Level 1" },
  { code: "CMMC_L2", name: "CMMC Level 2" },
  { code: "CIS_v8", name: "CIS Controls v8" },
  { code: "NIST_CSF_2", name: "NIST CSF 2.0" },
  { code: "HIPAA", name: "HIPAA Security Rule" },
  { code: "SOC2", name: "SOC 2" },
];

type Props = {
  tenantId: string;
  refreshKey?: number;
};

export function ComplianceScanResults({ tenantId, refreshKey }: Props) {
  const [framework, setFramework] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId });
      if (framework) params.set("framework", framework);
      const res = await fetch(`/api/compliance/scan-results?${params.toString()}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setError(json.error ?? "Failed to load results.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Network error loading compliance results.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, framework]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!tenantId) {
    return (
      <p className="mt-4 text-sm text-gray-500">Enter a Tenant ID above to view compliance scan results.</p>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Framework</label>
        <select
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {FRAMEWORKS.map((f) => (
            <option key={f.code} value={f.code}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {data && !loading ? (
        <>
          {/* Summary cards */}
          {data.summary.totalEvaluated > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryCard
                label="Readiness"
                value={data.summary.readinessPercent !== null ? `${data.summary.readinessPercent}%` : "—"}
                color="text-blue-700"
                bg="bg-blue-50"
              />
              <SummaryCard label="Pass" value={data.summary.pass} color="text-green-700" bg="bg-green-50" />
              <SummaryCard label="Fail" value={data.summary.fail} color="text-red-700" bg="bg-red-50" />
              <SummaryCard label="Partial" value={data.summary.partial} color="text-yellow-700" bg="bg-yellow-50" />
              <SummaryCard label="Unknown" value={data.summary.unknown} color="text-gray-600" bg="bg-gray-50" />
              <SummaryCard
                label="No Evidence"
                value={data.summary.evidence_missing}
                color="text-gray-500"
                bg="bg-gray-50"
              />
            </div>
          ) : null}

          {/* Top gaps */}
          {data.topGaps.length > 0 ? (
            <div>
              <h3 className="mb-3 text-base font-semibold text-gray-900">Top Compliance Gaps</h3>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Control</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Framework</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.topGaps.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{row.control_id}</p>
                          <p className="text-xs text-gray-500">{row.control_name}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.framework}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                          >
                            {STATUS_LABELS[row.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${SEVERITY_DOT[row.severity] ?? "bg-gray-300"}`}
                            />
                            <span className="capitalize text-gray-700">{row.severity}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.gap ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Full results */}
          {data.results.length > 0 ? (
            <div>
              <h3 className="mb-3 text-base font-semibold text-gray-900">
                All Controls ({data.results.length})
              </h3>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Control</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Framework</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Assessed</th>
                      <th className="w-8 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.results.map((row) => (
                      <>
                        <tr
                          key={row.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleRow(row.id)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{row.control_id}</p>
                            <p className="text-xs text-gray-500">{row.control_name}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{row.framework}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                            >
                              {STATUS_LABELS[row.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full ${SEVERITY_DOT[row.severity] ?? "bg-gray-300"}`}
                              />
                              <span className="capitalize text-gray-700">{row.severity}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(row.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {expandedRows.has(row.id) ? "▲" : "▼"}
                          </td>
                        </tr>
                        {expandedRows.has(row.id) ? (
                          <tr key={`${row.id}-detail`} className="bg-gray-50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="space-y-2 text-sm">
                                <p className="text-gray-700">
                                  <span className="font-medium">Evidence: </span>
                                  {(row.evidence as { evidenceSummary?: string }).evidenceSummary ?? "—"}
                                </p>
                                {row.gap ? (
                                  <p className="text-gray-700">
                                    <span className="font-medium">Gap: </span>
                                    {row.gap}
                                  </p>
                                ) : null}
                                {row.recommended_action ? (
                                  <p className="text-gray-700">
                                    <span className="font-medium">Recommended action: </span>
                                    {row.recommended_action}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
              No compliance scan results found. Run a compliance scan to evaluate your security posture.
            </p>
          )}
        </>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading compliance results…</p>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 ${bg} px-4 py-3`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
