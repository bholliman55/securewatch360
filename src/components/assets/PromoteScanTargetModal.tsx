"use client";

import { useEffect, useState } from "react";

interface ScanTarget {
  id: string;
  target_name: string;
  target_type: string;
  target_value: string;
}

const ENVIRONMENTS = ["production", "staging", "development", "testing", "other"] as const;
const CRITICALITIES = ["critical", "high", "medium", "low"] as const;

export function PromoteScanTargetModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [targets, setTargets] = useState<ScanTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [scanTargetId, setScanTargetId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [owner, setOwner] = useState("");
  const [environment, setEnvironment] = useState("");
  const [criticality, setCriticality] = useState("");
  const [internetFacing, setInternetFacing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((me: { tenants?: { id: string }[] }) => {
        const tenantId = me.tenants?.[0]?.id;
        if (!tenantId) return;
        return fetch(`/api/scan-targets?tenantId=${tenantId}&limit=500`)
          .then((r) => r.json())
          .then((d: { ok?: boolean; scanTargets?: ScanTarget[] }) => {
            if (d.ok) setTargets(d.scanTargets ?? []);
          });
      })
      .catch(() => {})
      .finally(() => setLoadingTargets(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanTargetId) { setError("Select a scan target"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/assets/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanTargetId,
          assetName: assetName.trim() || undefined,
          owner: owner.trim() || undefined,
          environment: environment || undefined,
          criticality: criticality || undefined,
          internetFacing,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Promote Scan Target to Asset</h2>
        <p className="mb-4 text-xs text-gray-500">
          Manually add any scan target (URL, webapp, CIDR, etc.) into the asset inventory as an owned asset.
        </p>

        {loadingTargets ? (
          <div className="h-10 animate-pulse rounded bg-gray-100" />
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Scan Target *</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={scanTargetId}
                onChange={(e) => setScanTargetId(e.target.value)}
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
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Owner (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ops@example.com"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Environment</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <option value="">Not set</option>
                  {ENVIRONMENTS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Criticality</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={criticality}
                  onChange={(e) => setCriticality(e.target.value)}
                >
                  <option value="">Not set</option>
                  {CRITICALITIES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={internetFacing}
                onChange={(e) => setInternetFacing(e.target.checked)}
              />
              Internet-facing
            </label>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {submitting ? "Promoting…" : "Promote to Asset"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
