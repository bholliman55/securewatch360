"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Asset {
  id: string;
  asset_identifier: string;
  asset_name: string | null;
  asset_type: string;
  display_name: string | null;
  hostname: string | null;
  ip_address: string | null;
  mac_address: string | null;
  operating_system: string | null;
  owner: string | null;
  location: string | null;
  environment: string | null;
  criticality: string | null;
  status: string;
  finding_count: number;
  critical_count: number;
  high_count: number;
  last_seen_at: string;
  source: string | null;
  source_scan_target_id: string | null;
  created_at: string;
}

interface ScanTarget {
  id: string;
  target_name: string;
  target_type: string;
  target_value: string;
  status: string;
}

interface Finding {
  id: string;
  severity: string;
  category: string | null;
  title: string;
  status: string;
  agent_type: string | null;
  created_at: string;
  scan_run_id: string | null;
}

interface ScanRun {
  id: string;
  scanner_name: string | null;
  scanner_type: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface AssetDetailResponse {
  asset: Asset;
  scanTarget: ScanTarget | null;
  findings: Finding[];
  scanRuns: ScanRun[];
}

function severityClass(s: string) {
  if (s === "critical") return "bg-red-100 text-red-700";
  if (s === "high") return "bg-orange-100 text-orange-700";
  if (s === "medium") return "bg-yellow-100 text-yellow-700";
  if (s === "low") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

function criticalityClass(c: string | null) {
  if (c === "critical") return "bg-red-100 text-red-700";
  if (c === "high") return "bg-orange-100 text-orange-700";
  if (c === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

function statusClass(s: string) {
  if (s === "active") return "bg-green-100 text-green-700";
  if (s === "inactive") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
}

export function AssetDetailClient({ assetId }: { assetId: string }) {
  const [data, setData] = useState<AssetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.json())
      .then((d: AssetDetailResponse & { error?: string }) => {
        if (d.error) { setError(d.error); }
        else { setData(d); }
        setLoading(false);
      })
      .catch(() => { setError("Failed to load asset"); setLoading(false); });
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {error ?? "Asset not found"}
      </div>
    );
  }

  const { asset, scanTarget, findings, scanRuns } = data;
  const label = asset.asset_name ?? asset.display_name ?? asset.asset_identifier;

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link href="/assets" className="text-sm text-blue-600 hover:underline">
        ← Back to Asset Inventory
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{label}</h1>
          <p className="mt-0.5 font-mono text-sm text-gray-400">{asset.asset_identifier}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {asset.asset_type}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(asset.status)}`}>
            {asset.status}
          </span>
          {asset.criticality && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${criticalityClass(asset.criticality)}`}>
              {asset.criticality}
            </span>
          )}
        </div>
      </div>

      {/* Key details grid */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 p-5 sm:grid-cols-3">
        {asset.hostname && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hostname</dt>
            <dd className="mt-1 font-mono text-sm text-gray-800">{asset.hostname}</dd>
          </div>
        )}
        {asset.ip_address && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">IP Address</dt>
            <dd className="mt-1 font-mono text-sm text-gray-800">{asset.ip_address}</dd>
          </div>
        )}
        {asset.mac_address && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">MAC Address</dt>
            <dd className="mt-1 font-mono text-sm text-gray-800">{asset.mac_address}</dd>
          </div>
        )}
        {asset.operating_system && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">OS</dt>
            <dd className="mt-1 text-sm text-gray-800">{asset.operating_system}</dd>
          </div>
        )}
        {asset.owner && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Owner</dt>
            <dd className="mt-1 text-sm text-gray-800">{asset.owner}</dd>
          </div>
        )}
        {asset.environment && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Environment</dt>
            <dd className="mt-1 text-sm text-gray-800">{asset.environment}</dd>
          </div>
        )}
        {asset.location && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Location</dt>
            <dd className="mt-1 text-sm text-gray-800">{asset.location}</dd>
          </div>
        )}
        {asset.source && (
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Source</dt>
            <dd className="mt-1 text-sm text-gray-800">{asset.source}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Seen</dt>
          <dd className="mt-1 text-sm text-gray-800">{new Date(asset.last_seen_at).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Added</dt>
          <dd className="mt-1 text-sm text-gray-800">{new Date(asset.created_at).toLocaleDateString()}</dd>
        </div>
      </div>

      {/* Finding counts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{asset.finding_count}</div>
          <div className="mt-1 text-xs text-gray-400">Total Findings</div>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{asset.critical_count}</div>
          <div className="mt-1 text-xs text-red-400">Critical</div>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{asset.high_count}</div>
          <div className="mt-1 text-xs text-orange-400">High</div>
        </div>
      </div>

      {/* Source scan target */}
      {scanTarget && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Source Scan Target</h2>
          <div className="rounded-xl border border-gray-200 p-4 text-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{scanTarget.target_type}</span>
              <span className="font-medium text-gray-800">{scanTarget.target_name}</span>
              <span className="font-mono text-gray-400">{scanTarget.target_value}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${scanTarget.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {scanTarget.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Findings ({findings.length})
          </h2>
          {findings.length > 0 && (
            <Link href={`/findings?assetId=${asset.id}`} className="text-xs text-blue-600 hover:underline">
              View all in findings →
            </Link>
          )}
        </div>
        {findings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
            No findings linked to this asset.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Found</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {findings.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityClass(f.severity)}`}>
                        {f.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">{f.title}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.category ?? "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.agent_type ?? "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.status}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scan runs */}
      {scanRuns.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Recent Scan Runs ({scanRuns.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Scanner</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Started</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scanRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.scanner_name ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.scanner_type ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "completed" ? "bg-green-100 text-green-700" : r.status === "running" ? "bg-blue-100 text-blue-700" : r.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
