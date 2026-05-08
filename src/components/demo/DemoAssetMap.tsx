"use client";

/**
 * DemoAssetMap — a compact, list-style map of every demo asset with its
 * current simulated status. Stable order keyed by `asset_name`.
 *
 * No literal cartography — the spec calls for clean, serious UI without
 * cartoons. This is a labelled inventory that updates as the replay
 * progresses.
 */

import type { DemoAssetRow } from "@/demo/investorMode";

export interface DemoAssetMapProps {
  assets: ReadonlyArray<DemoAssetRow>;
}

export function DemoAssetMap({ assets }: DemoAssetMapProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="asset-map-title"
      className="rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <header className="border-b border-gray-100 px-5 py-4">
        <h2 id="asset-map-title" className="text-base font-semibold text-gray-900">
          Asset map
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {assets.length} asset{assets.length === 1 ? "" : "s"} in scope
        </p>
      </header>
      <ul className="divide-y divide-gray-100">
        {assets.length === 0 && (
          <li className="px-5 py-4 text-sm text-gray-500">
            Seed the demo to load assets.
          </li>
        )}
        {assets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

const STATUS_TONE: Record<DemoAssetRow["status"], string> = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspicious: "bg-amber-50 text-amber-800 border-amber-200",
  at_risk: "bg-orange-50 text-orange-800 border-orange-200",
  compromised: "bg-rose-50 text-rose-700 border-rose-200",
  compromised_simulated: "bg-rose-50 text-rose-700 border-rose-200",
  isolated: "bg-sky-50 text-sky-700 border-sky-200",
  isolated_simulated: "bg-sky-50 text-sky-700 border-sky-200",
  remediated: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function AssetRow({ asset }: { asset: DemoAssetRow }): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <AssetIcon type={asset.asset_type} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900">{asset.asset_name}</div>
        <div className="text-xs text-gray-500">
          {humanizeAssetType(asset.asset_type)} · risk {asset.risk_level}
        </div>
      </div>
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[asset.status]}`}
      >
        {humanizeStatus(asset.status)}
      </span>
    </li>
  );
}

function humanizeAssetType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeStatus(status: string): string {
  return status.replace(/_simulated$/, " (sim)").replace(/_/g, " ");
}

/**
 * Deliberately minimal SVG glyphs — geometric, no faces or characters, in
 * line with the "no cartoons" requirement.
 */
function AssetIcon({ type }: { type: string }): React.JSX.Element {
  const common = "h-8 w-8 shrink-0 rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-500";
  if (type === "endpoint") {
    return (
      <svg
        aria-hidden
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="5" width="18" height="11" rx="1.5" />
        <path d="M2 19h20" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "file_server") {
    return (
      <svg
        aria-hidden
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="4" y="4" width="16" height="6" rx="1" />
        <rect x="4" y="14" width="16" height="6" rx="1" />
        <circle cx="7" cy="7" r="0.6" fill="currentColor" />
        <circle cx="7" cy="17" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  if (type === "network_gateway") {
    return (
      <svg
        aria-hidden
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4v16" />
      </svg>
    );
  }
  if (type === "cloud_identity") {
    return (
      <svg
        aria-hidden
        className={common}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M7 16a4 4 0 010-8 5 5 0 019.6-1A4 4 0 0117 16H7z" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      className={common}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
