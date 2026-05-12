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
  operating_system: string | null;
  owner: string | null;
  environment: string | null;
  criticality: string | null;
  status: string;
  finding_count: number;
  critical_count: number;
  high_count: number;
  last_seen_at: string;
  source: string | null;
}

interface AssetsResponse {
  assets: Asset[];
  typeCounts: Record<string, number>;
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

export function AssetInventoryTable() {
  const [data, setData] = useState<AssetsResponse | null>(null);
  const [activeType, setActiveType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const load = (type?: string) => {
    setLoading(true);
    const params = type && type !== "all" ? `?type=${type}` : "";
    fetch(`/api/assets${params}`)
      .then((r) => r.json())
      .then((d: AssetsResponse) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleRebuild = async () => {
    setRebuilding(true);
    await fetch("/api/assets", { method: "POST" });
    load(activeType);
    setRebuilding(false);
  };

  const handleTypeFilter = (type: string) => {
    setActiveType(type);
    load(type === "all" ? undefined : type);
  };

  const types = data ? Object.entries(data.typeCounts) : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Type filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleTypeFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${activeType === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All ({data ? Object.values(data.typeCounts).reduce((a, b) => a + b, 0) : 0})
        </button>
        {types.map(([type, count]) => (
          <button
            key={type}
            onClick={() => handleTypeFilter(type)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${activeType === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {type} ({count})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Assets are network/infrastructure inventory. URLs and web targets are scan targets, not assets.
          </span>
          <button
            onClick={() => void handleRebuild()}
            disabled={rebuilding}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            {rebuilding ? "Rebuilding…" : "Rebuild from Scan Targets"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      ) : !data?.assets.length ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">
            No assets found. Only IP, hostname, domain, and cloud account scan targets are indexed as assets.
          </p>
          <p className="mt-1 text-xs text-gray-300">
            Run &quot;Rebuild from Scan Targets&quot; or scan a network target to populate this inventory.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Host / IP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Environment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Criticality</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Findings</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Critical</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">High</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.assets.map((a) => {
                const label = a.asset_name ?? a.display_name ?? a.asset_identifier;
                const hostDetail = a.hostname ?? a.ip_address ?? null;
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {label}
                      {a.owner ? (
                        <div className="text-xs text-gray-400">Owner: {a.owner}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{a.asset_type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{hostDetail ?? "-"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.environment ?? "-"}</td>
                    <td className="px-4 py-3">
                      {a.criticality ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${criticalityClass(a.criticality)}`}>
                          {a.criticality}
                        </span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(a.status)}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.finding_count > 0 ? (
                        <Link
                          href={`/findings?assetId=${a.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                          title="View findings for this asset"
                        >
                          {a.finding_count}
                        </Link>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.critical_count > 0 && (
                        <span className="font-semibold text-red-600">{a.critical_count}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.high_count > 0 && (
                        <span className="font-semibold text-orange-600">{a.high_count}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(a.last_seen_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
