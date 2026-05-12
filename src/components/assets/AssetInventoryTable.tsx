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

interface ScanTarget {
  id: string;
  target_name: string;
  target_type: string;
  target_value: string;
  status: string;
}

interface ScanTargetsResponse {
  ok: boolean;
  scanTargets: ScanTarget[];
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

const ENVIRONMENTS = ["production", "staging", "development", "testing", "other"] as const;
const CRITICALITIES = ["critical", "high", "medium", "low"] as const;

interface PromoteForm {
  scanTargetId: string;
  assetName: string;
  owner: string;
  environment: string;
  criticality: string;
}

function PromoteModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [targets, setTargets] = useState<ScanTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PromoteForm>({
    scanTargetId: "",
    assetName: "",
    owner: "",
    environment: "",
    criticality: "",
  });

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((me: { tenants?: { id: string }[] }) => {
        const tenantId = me.tenants?.[0]?.id;
        if (!tenantId) return;
        return fetch(`/api/scan-targets?tenantId=${tenantId}&limit=500`)
          .then((r) => r.json())
          .then((d: ScanTargetsResponse) => {
            if (d.ok) setTargets(d.scanTargets ?? []);
          });
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoadingTargets(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scanTargetId) { setError("Select a scan target"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/assets/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanTargetId: form.scanTargetId,
          assetName: form.assetName || undefined,
          owner: form.owner || undefined,
          environment: form.environment || undefined,
          criticality: form.criticality || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Promotion failed"); return; }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: keyof PromoteForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Promote Scan Target to Asset</h2>
        <p className="mb-4 text-xs text-gray-500">
          Manually add any scan target (URL, webapp, CIDR, etc.) into the asset inventory as an owned technology asset.
        </p>

        {loadingTargets ? (
          <div className="h-10 animate-pulse rounded bg-gray-100" />
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Scan Target *</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.scanTargetId}
                onChange={(e) => field("scanTargetId", e.target.value)}
                required
              >
                <option value="">Select a scan target…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.target_type}] {t.target_name} — {t.target_value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Asset Name (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Production Web Server"
                value={form.assetName}
                onChange={(e) => field("assetName", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Owner (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. ops-team@example.com"
                value={form.owner}
                onChange={(e) => field("owner", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Environment</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.environment}
                  onChange={(e) => field("environment", e.target.value)}
                >
                  <option value="">Not set</option>
                  {ENVIRONMENTS.map((env) => <option key={env} value={env}>{env}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Criticality</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.criticality}
                  onChange={(e) => field("criticality", e.target.value)}
                >
                  <option value="">Not set</option>
                  {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Promoting…" : "Promote to Asset"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AssetInventoryTable() {
  const [data, setData] = useState<AssetsResponse | null>(null);
  const [activeType, setActiveType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

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

  const handlePromoteDone = () => {
    setShowPromote(false);
    load(activeType);
  };

  const types = data ? Object.entries(data.typeCounts) : [];

  return (
    <div className="flex flex-col gap-4">
      {showPromote && (
        <PromoteModal onClose={() => setShowPromote(false)} onDone={handlePromoteDone} />
      )}

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
            onClick={() => setShowPromote(true)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100"
          >
            Promote Scan Target
          </button>
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
            No assets found. Only IP, hostname, domain, and cloud account scan targets are indexed as assets automatically.
          </p>
          <p className="mt-1 text-xs text-gray-300">
            Run &quot;Rebuild from Scan Targets&quot; or use &quot;Promote Scan Target&quot; to add any target manually.
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
                      <Link href={`/assets/${a.id}`} className="hover:text-blue-600 hover:underline">
                        {label}
                      </Link>
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
