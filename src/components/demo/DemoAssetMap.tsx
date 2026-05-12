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
      style={{
        borderRadius: 12,
        border: "1px solid rgba(41,182,246,0.2)",
        background: "#0d1e33",
        boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid rgba(176,196,222,0.12)",
          padding: "0.85rem 1.25rem",
          display: "flex",
          alignItems: "baseline",
          gap: "0.65rem",
        }}
      >
        <h2
          id="asset-map-title"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 600,
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8ab4d4",
            margin: 0,
          }}
        >
          Asset Map
        </h2>
        <p style={{ fontSize: "0.7rem", color: "#8ab4d4", margin: 0 }}>
          {assets.length} asset{assets.length === 1 ? "" : "s"} in scope
        </p>
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {assets.length === 0 && (
          <li style={{ padding: "1rem 1.25rem", fontSize: "0.8rem", color: "#8ab4d4", fontStyle: "italic" }}>
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

const STATUS_TONE: Record<
  DemoAssetRow["status"],
  { bg: string; color: string; border: string }
> = {
  healthy: { bg: "rgba(34,197,94,0.08)", color: "#22c55e", border: "rgba(34,197,94,0.25)" },
  suspicious: { bg: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  at_risk: { bg: "rgba(251,146,60,0.08)", color: "#fb923c", border: "rgba(251,146,60,0.3)" },
  compromised: { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
  compromised_simulated: { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
  isolated: { bg: "rgba(41,182,246,0.08)", color: "#29b6f6", border: "rgba(41,182,246,0.25)" },
  isolated_simulated: { bg: "rgba(41,182,246,0.08)", color: "#29b6f6", border: "rgba(41,182,246,0.25)" },
  remediated: { bg: "rgba(34,197,94,0.08)", color: "#22c55e", border: "rgba(34,197,94,0.25)" },
};

function AssetRow({ asset }: { asset: DemoAssetRow }): React.JSX.Element {
  const tone = STATUS_TONE[asset.status];
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.65rem 1.25rem",
        borderBottom: "1px solid rgba(176,196,222,0.07)",
      }}
    >
      <AssetIcon type={asset.asset_type} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0" }}>
          {asset.asset_name}
        </div>
        <div style={{ fontSize: "0.7rem", color: "#8ab4d4", marginTop: 1 }}>
          {humanizeAssetType(asset.asset_type)} · risk {asset.risk_level}
        </div>
      </div>
      <span
        style={{
          display: "inline-flex",
          flexShrink: 0,
          alignItems: "center",
          borderRadius: 9999,
          border: `1px solid ${tone.border}`,
          background: tone.bg,
          padding: "0.12rem 0.5rem",
          fontSize: "0.62rem",
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: tone.color,
        }}
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
  const common = "h-8 w-8 shrink-0 rounded-md p-1.5";
  const iconStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: 7,
    border: "1px solid rgba(41,182,246,0.25)",
    background: "rgba(41,182,246,0.07)",
    padding: "5px",
    color: "#29b6f6",
    display: "inline-flex",
  };
  if (type === "endpoint") {
    return (
      <svg aria-hidden style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="5" width="18" height="11" rx="1.5" />
        <path d="M2 19h20" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "file_server") {
    return (
      <svg aria-hidden style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="4" y="4" width="16" height="6" rx="1" />
        <rect x="4" y="14" width="16" height="6" rx="1" />
        <circle cx="7" cy="7" r="0.6" fill="currentColor" />
        <circle cx="7" cy="17" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  if (type === "network_gateway") {
    return (
      <svg aria-hidden style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4v16" />
      </svg>
    );
  }
  if (type === "cloud_identity") {
    return (
      <svg aria-hidden style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M7 16a4 4 0 010-8 5 5 0 019.6-1A4 4 0 0117 16H7z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
