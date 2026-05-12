"use client";

import { useState } from "react";

const ASSET_TYPES = [
  "server", "workstation", "laptop", "mobile", "network", "firewall",
  "webapp", "database", "container", "repository", "ip", "hostname",
  "domain", "cloud_account", "iot", "other",
] as const;
const ENVIRONMENTS = ["production", "staging", "development", "testing", "other"] as const;
const CRITICALITIES = ["critical", "high", "medium", "low"] as const;

interface AddAssetForm {
  assetIdentifier: string;
  assetName: string;
  assetType: string;
  hostname: string;
  ipAddress: string;
  operatingSystem: string;
  owner: string;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  notes: string;
}

const EMPTY: AddAssetForm = {
  assetIdentifier: "", assetName: "", assetType: "", hostname: "",
  ipAddress: "", operatingSystem: "", owner: "", environment: "",
  criticality: "", internetFacing: false, notes: "",
};

export function AddAssetModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<AddAssetForm>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof AddAssetForm, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetIdentifier.trim()) { setError("Asset identifier is required"); return; }
    if (!form.assetType) { setError("Asset type is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIdentifier: form.assetIdentifier.trim(),
          assetName: form.assetName.trim() || undefined,
          assetType: form.assetType,
          hostname: form.hostname.trim() || undefined,
          ipAddress: form.ipAddress.trim() || undefined,
          operatingSystem: form.operatingSystem.trim() || undefined,
          owner: form.owner.trim() || undefined,
          environment: form.environment || undefined,
          criticality: form.criticality || undefined,
          internetFacing: form.internetFacing,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create asset"); return; }
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
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Add Asset Manually</h2>
        <p className="mb-4 text-xs text-gray-500">
          Add a server, device, or other asset directly to the inventory without needing a scan target.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Asset Identifier * <span className="font-normal text-gray-400">(unique: hostname, IP, or slug)</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. prod-web-01.example.com"
                value={form.assetIdentifier}
                onChange={(e) => set("assetIdentifier", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Friendly Name</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Production Web Server"
                value={form.assetName}
                onChange={(e) => set("assetName", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Asset Type *</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.assetType}
                onChange={(e) => set("assetType", e.target.value)}
                required
              >
                <option value="">Select type…</option>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Hostname</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="prod-web-01.internal"
                value={form.hostname}
                onChange={(e) => set("hostname", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">IP Address</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10.0.0.1"
                value={form.ipAddress}
                onChange={(e) => set("ipAddress", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Operating System</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ubuntu 22.04 LTS"
                value={form.operatingSystem}
                onChange={(e) => set("operatingSystem", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Owner</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ops@example.com or Team Name"
                value={form.owner}
                onChange={(e) => set("owner", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Environment</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.environment}
                onChange={(e) => set("environment", e.target.value)}
              >
                <option value="">Not set</option>
                {ENVIRONMENTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Criticality</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.criticality}
                onChange={(e) => set("criticality", e.target.value)}
              >
                <option value="">Not set</option>
                {CRITICALITIES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Ownership context, remediation notes, etc."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={form.internetFacing}
              onChange={(e) => set("internetFacing", e.target.checked)}
            />
            Internet-facing (publicly reachable)
          </label>

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
              {submitting ? "Saving…" : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
