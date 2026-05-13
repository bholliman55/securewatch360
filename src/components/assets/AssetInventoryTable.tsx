"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AddAssetModal } from "./AddAssetModal";
import { PromoteScanTargetModal } from "./PromoteScanTargetModal";

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
  internet_facing: boolean;
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

interface Filters {
  type: string;
  criticality: string;
  environment: string;
  status: string;
  internetFacing: string;
  search: string;
}

const EMPTY_FILTERS: Filters = {
  type: "", criticality: "", environment: "", status: "", internetFacing: "", search: "",
};

const CRITICALITIES = ["critical", "high", "medium", "low"];
const ENVIRONMENTS = ["production", "staging", "development", "testing", "other"];
const STATUSES = ["active", "inactive", "decommissioned"];

function criticalityBadge(c: string | null) {
  if (!c) return <span className="text-gray-300 text-xs">—</span>;
  const cls =
    c === "critical" ? "bg-red-100 text-red-700" :
    c === "high" ? "bg-orange-100 text-orange-700" :
    c === "medium" ? "bg-yellow-100 text-yellow-700" :
    "bg-blue-100 text-blue-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{c}</span>;
}

function statusBadge(s: string) {
  const cls =
    s === "active" ? "bg-green-100 text-green-700" :
    s === "inactive" ? "bg-yellow-100 text-yellow-700" :
    "bg-gray-100 text-gray-500";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s}</span>;
}

function buildParams(filters: Filters): string {
  const p = new URLSearchParams();
  if (filters.type) p.set("type", filters.type);
  if (filters.criticality) p.set("criticality", filters.criticality);
  if (filters.environment) p.set("environment", filters.environment);
  if (filters.status) p.set("status", filters.status);
  if (filters.internetFacing) p.set("internetFacing", filters.internetFacing);
  if (filters.search) p.set("search", filters.search);
  return p.toString() ? `?${p.toString()}` : "";
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = (f: Filters) => {
    setLoading(true);
    fetch(`/api/assets${buildParams(f)}`)
      .then((r) => r.json())
      .then((d: AssetsResponse) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(EMPTY_FILTERS); }, []);

  const setFilter = <K extends keyof Filters>(key: K, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key === "search") {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => load(next), 300);
    } else {
      load(next);
    }
  };

  const clearFilters = () => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS); };

  const handleRebuild = async () => {
    setRebuilding(true);
    await fetch("/api/assets/rebuild", { method: "POST" });
    load(filters);
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

  const hasActiveFilter = Object.values(filters).some(Boolean);
  const types = data ? Object.entries(data.typeCounts) : [];
  const totalCount = data ? Object.values(data.typeCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(filters); }} />}
      {showPromote && <PromoteScanTargetModal onClose={() => setShowPromote(false)} onDone={() => { setShowPromote(false); load(filters); }} />}

      {/* Search + action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search by name, hostname, IP, or owner…"
          className="w-72 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            + Add Asset
          </button>
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
            {rebuilding ? "Rebuilding…" : "Rebuild from Scans"}
          </button>
        </div>
      </div>

      {/* Type chips + filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("type", "")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!filters.type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All ({totalCount})
        </button>
        {types.map(([type, count]) => (
          <button
            key={type}
            onClick={() => setFilter("type", filters.type === type ? "" : type)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filters.type === type ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {type} ({count})
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filters.criticality}
            onChange={(e) => setFilter("criticality", e.target.value)}
          >
            <option value="">Criticality</option>
            {CRITICALITIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filters.environment}
            onChange={(e) => setFilter("environment", e.target.value)}
          >
            <option value="">Environment</option>
            {ENVIRONMENTS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="">Status</option>
            {STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filters.internetFacing}
            onChange={(e) => setFilter("internetFacing", e.target.value)}
          >
            <option value="">Internet-facing</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>

          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table / empty state */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      ) : !data?.assets.length ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          {hasActiveFilter ? (
            <>
              <p className="text-sm text-gray-400">No assets match the current filters.</p>
              <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:underline">Clear filters</button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-500">No assets discovered yet.</p>
              <p className="mt-1 text-xs text-gray-400">
                Run a scan or add assets manually to begin building your inventory.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => setShowAdd(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add Asset Manually
                </button>
                <button
                  onClick={() => void handleRebuild()}
                  disabled={rebuilding}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  {rebuilding ? "Rebuilding…" : "Rebuild from Scans"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">IP / Hostname</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Criticality</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Environment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Findings</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.assets.map((a) => {
                const label = a.asset_name ?? a.display_name ?? a.asset_identifier;
                const hostDetail = a.hostname ?? a.ip_address ?? a.asset_identifier;
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/assets/${a.id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">
                        {label}
                      </Link>
                      {a.internet_facing && (
                        <span className="ml-2 rounded-full bg-orange-50 px-1.5 py-0.5 text-xs text-orange-500">internet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{a.asset_type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{hostDetail}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.owner ?? "—"}</td>
                    <td className="px-4 py-3">{criticalityBadge(a.criticality)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{a.environment ?? "—"}</td>
                    <td className="px-4 py-3">{statusBadge(a.status)}</td>
                    <td className="px-4 py-3 text-center">
                      {a.finding_count > 0 ? (
                        <Link
                          href={`/findings?assetId=${a.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                          title="View findings"
                        >
                          {a.finding_count}
                          {a.critical_count > 0 && (
                            <span className="ml-1 text-red-500">({a.critical_count}C)</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(a.last_seen_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Assets are owned technology inventory. Scan targets (URLs, CIDRs, webapps) are separate — use &quot;Promote Scan Target&quot; to add them here manually.
      </p>
    </div>
  );
}
