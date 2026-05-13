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
  internet_facing: boolean;
  finding_count: number;
  critical_count: number;
  high_count: number;
  last_seen_at: string;
  source: string | null;
  source_scan_target_id: string | null;
  notes: string | null;
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

function runStatusClass(s: string) {
  if (s === "completed") return "bg-green-100 text-green-700";
  if (s === "running") return "bg-blue-100 text-blue-700";
  if (s === "failed") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-500";
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800">{value}</dd>
    </div>
  );
}

export function AssetDetailClient({ assetId }: { assetId: string }) {
  const [data, setData] = useState<AssetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/assets/${assetId}`)
      .then((r) => r.json())
      .then((d: AssetDetailResponse & { error?: string }) => {
        if (d.error) setFetchError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setFetchError("Failed to load asset"); setLoading(false); });
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {fetchError ?? "Asset not found"}
      </div>
    );
  }

  const { asset, scanTarget, findings, scanRuns } = data;
  const label = asset.asset_name ?? asset.display_name ?? asset.asset_identifier;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/assets" className="text-sm text-blue-600 hover:underline">← Back to Asset Inventory</Link>

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{asset.asset_type}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(asset.status)}`}>{asset.status}</span>
          {asset.criticality && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${critClass(asset.criticality)}`}>{asset.criticality}</span>
          )}
          {asset.internet_facing && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-600">internet-facing</span>
          )}
        </div>
      </div>

      {/* Details grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-gray-200 p-5 sm:grid-cols-3">
        <MetaRow label="Hostname" value={asset.hostname ? <span className="font-mono">{asset.hostname}</span> : null} />
        <MetaRow label="IP Address" value={asset.ip_address ? <span className="font-mono">{asset.ip_address}</span> : null} />
        <MetaRow label="MAC Address" value={asset.mac_address ? <span className="font-mono">{asset.mac_address}</span> : null} />
        <MetaRow label="OS" value={asset.operating_system} />
        <MetaRow label="Owner" value={asset.owner} />
        <MetaRow label="Environment" value={asset.environment} />
        <MetaRow label="Location" value={asset.location} />
        <MetaRow label="Source" value={asset.source} />
        <MetaRow label="Last Seen" value={new Date(asset.last_seen_at).toLocaleDateString()} />
        <MetaRow label="Added" value={new Date(asset.created_at).toLocaleDateString()} />
      </dl>

      {asset.notes && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Notes</p>
          {asset.notes}
        </div>
      )}

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
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Related Scan Targets</h2>
          <div className="rounded-xl border border-gray-200 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
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
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Severity</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Agent</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Found</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {findings.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sevClass(f.severity)}`}>{f.severity}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">{f.title}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.category ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.agent_type ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{f.status}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scan history */}
      {scanRuns.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Scan History ({scanRuns.length})
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Scanner</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Started</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scanRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.scanner_name ?? r.id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.scanner_type ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${runStatusClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}</td>
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
