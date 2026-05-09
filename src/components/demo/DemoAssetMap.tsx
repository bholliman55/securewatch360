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
import styles from "./DemoAssetMap.module.css";

export interface DemoAssetMapProps {
  assets: ReadonlyArray<DemoAssetRow>;
}

export function DemoAssetMap({ assets }: DemoAssetMapProps): React.JSX.Element {
  return (
    <section aria-labelledby="asset-map-title" className={styles.section}>
      <header className={styles.header}>
        <h2 id="asset-map-title" className={styles.title}>
          Asset Map
        </h2>
        <p className={styles.subtitle}>
          {assets.length} asset{assets.length === 1 ? "" : "s"} in scope
        </p>
      </header>
      <ul className={styles.list}>
        {assets.length === 0 && (
          <li className={styles.emptyItem}>Seed the demo to load assets.</li>
        )}
        {assets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

const BADGE_CLASS: Record<DemoAssetRow["status"], string> = {
  healthy: styles.badgeHealthy,
  suspicious: styles.badgeSuspicious,
  at_risk: styles.badgeAtRisk,
  compromised: styles.badgeCompromised,
  compromised_simulated: styles.badgeCompromised,
  isolated: styles.badgeIsolated,
  isolated_simulated: styles.badgeIsolated,
  remediated: styles.badgeRemediated,
};

function AssetRow({ asset }: { asset: DemoAssetRow }): React.JSX.Element {
  return (
    <li className={styles.assetRow}>
      <AssetIcon type={asset.asset_type} />
      <div className={styles.assetInfo}>
        <div className={styles.assetName}>{asset.asset_name}</div>
        <div className={styles.assetMeta}>
          {humanizeAssetType(asset.asset_type)} · risk {asset.risk_level}
        </div>
      </div>
      <span className={`${styles.badge} ${BADGE_CLASS[asset.status]}`}>
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
  const svgProps = {
    "aria-hidden": true,
    className: styles.icon,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
  } as const;

  if (type === "endpoint") {
    return (
      <svg {...svgProps}>
        <rect x="3" y="5" width="18" height="11" rx="1.5" />
        <path d="M2 19h20" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "file_server") {
    return (
      <svg {...svgProps}>
        <rect x="4" y="4" width="16" height="6" rx="1" />
        <rect x="4" y="14" width="16" height="6" rx="1" />
        <circle cx="7" cy="7" r="0.6" fill="currentColor" />
        <circle cx="7" cy="17" r="0.6" fill="currentColor" />
      </svg>
    );
  }
  if (type === "network_gateway") {
    return (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 12h16M12 4v16" />
      </svg>
    );
  }
  if (type === "cloud_identity") {
    return (
      <svg {...svgProps}>
        <path d="M7 16a4 4 0 010-8 5 5 0 019.6-1A4 4 0 0117 16H7z" />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
