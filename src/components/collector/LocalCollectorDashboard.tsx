"use client";

import { useEffect, useState } from "react";

type DiskEntry = {
  drive?: string;
  freeBytes?: number;
  totalBytes?: number;
};

type CollectorInventory = {
  collector_id: string;
  collected_at: string;
  host: {
    hostname?: string;
    osType?: string;
    platform?: string;
    osRelease?: string;
    arch?: string;
    cpuCount?: number;
    cpuModel?: string;
    cpuSpeedMHz?: number;
    totalMemoryBytes?: number;
    freeMemoryBytes?: number;
    disk?: DiskEntry[];
  };
  network: {
    interfaces?: Array<{ address?: string; family?: string; mac?: string }>; 
    macAddresses?: string[];
  };
  software: { installed?: Array<Record<string, unknown>> };
  processes: { count?: number };
  ports: { count?: number };
  errors?: string[];
};

type ApiError = { error: string; detail?: string };

function formatBytes(value?: number) {
  if (typeof value !== "number") return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let bytes = value;
  let index = 0;
  while (bytes >= 1024 && index < units.length - 1) {
    bytes /= 1024;
    index += 1;
  }
  return `${bytes.toFixed(1)} ${units[index]}`;
}

function formatPercent(part?: number, total?: number) {
  if (typeof part !== "number" || typeof total !== "number" || total === 0) return "—";
  return `${((part / total) * 100).toFixed(0)}%`;
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return "Not available";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function getIpAddresses(inventory: CollectorInventory | null) {
  return inventory?.network?.interfaces
    ?.filter((entry) => entry.address && entry.family === "IPv4")
    .map((entry) => entry.address)
    .filter(Boolean) as string[] ?? [];
}

function getDiskSummary(disk: DiskEntry[] = []) {
  return disk.map((entry) => {
    const capacity = formatBytes(entry.totalBytes);
    const free = formatBytes(entry.freeBytes);
    return `${entry.drive ?? "Drive"}: ${free} free / ${capacity}`;
  });
}

export default function LocalCollectorDashboard() {
  const [inventory, setInventory] = useState<CollectorInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCollectorData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/collector/local", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        setInventory(null);
        setError(payload?.error ?? "Failed to load local collector data.");
        return;
      }

      const json = (await response.json()) as CollectorInventory;
      setInventory(json);
    } catch (err) {
      setInventory(null);
      setError(err instanceof Error ? err.message : "Unexpected error loading collector data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollectorData();
  }, []);

  const statusLabel = inventory
    ? inventory.errors?.length
      ? "Collector warning"
      : "Collector healthy"
    : "Collector data pending";
  const statusColor = inventory
    ? inventory.errors?.length
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-800";

  const softwareCount = inventory?.software?.installed?.length ?? 0;
  const processCount = inventory?.processes?.count ?? 0;
  const portCount = inventory?.ports?.count ?? 0;
  const ipAddresses = getIpAddresses(inventory ?? ({} as CollectorInventory));
  const macAddresses = inventory?.network?.macAddresses ?? [];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
              Local collector preview
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Collector status and inventory
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              This developer preview reads the latest collector report from the local
              site-collector output file and renders the inventory data in the app.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${statusColor}`}>
              {statusLabel}
            </div>
            <button
              type="button"
              onClick={loadCollectorData}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Refreshing…" : "Refresh Collector Data"}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <p className="font-semibold text-rose-800">Collector error</p>
          <p className="mt-2">{error}</p>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Inventory snapshot</h3>
              <p className="mt-2 text-sm text-slate-500">
                Latest report loaded from the local collector output file.
              </p>
            </div>
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              {formatTimestamp(inventory?.collected_at)}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Host</p>
              <p className="mt-3 text-xl font-semibold text-slate-900">{inventory?.host.hostname ?? "—"}</p>
              <p className="mt-2 text-sm text-slate-600">
                {inventory?.host.osType ?? "—"} {inventory?.host.osRelease ?? ""}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {inventory?.host.arch ?? "—"} • {inventory?.host.cpuModel ?? "—"}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resource summary</p>
              <p className="mt-3 text-xl font-semibold text-slate-900">
                {inventory?.host.cpuCount ?? "—"} CPU • {formatBytes(inventory?.host.totalMemoryBytes)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Free memory: {formatBytes(inventory?.host.freeMemoryBytes)} ({formatPercent(inventory?.host.freeMemoryBytes, inventory?.host.totalMemoryBytes)})
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {getDiskSummary(inventory?.host.disk).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Installed software</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{softwareCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Running processes</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{processCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Listening ports</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{portCount}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Network details</h3>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">IP addresses</p>
                <p className="mt-2">{ipAddresses.length ? ipAddresses.join(", ") : "None detected"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">MAC addresses</p>
                <p className="mt-2">{macAddresses.length ? macAddresses.join(", ") : "None detected"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Collector output</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Data is sourced from the locally mounted collector report under the local development workspace.
            </p>
            <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Collector ID:</span> {inventory?.collector_id ?? "—"}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-900">Schema:</span> {inventory?.schema_version ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
