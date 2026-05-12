import { randomUUID } from "node:crypto";
import type { BusinessAsset, BusinessCriticality, SourceSystemAttribution } from "./asset.schema";
import { businessAssetSchema } from "./asset.schema";

const CRITICALITY_RANK: Record<BusinessCriticality, number> = {
  mission_critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
};

function maxCriticality(a: BusinessCriticality, b: BusinessCriticality): BusinessCriticality {
  return CRITICALITY_RANK[a] >= CRITICALITY_RANK[b] ? a : b;
}

function uniqueStrings(a: string[]): string[] {
  return [...new Set(a.map((s) => s.trim()).filter(Boolean))];
}

function mergeSourceSystems(
  a: SourceSystemAttribution[],
  b: SourceSystemAttribution[],
): SourceSystemAttribution[] {
  const byName = new Map<string, SourceSystemAttribution>();
  for (const row of [...a, ...b]) {
    const key = row.source_system.toLowerCase();
    const prev = byName.get(key);
    if (!prev || row.confidence > prev.confidence) {
      byName.set(key, {
        source_system: row.source_system,
        confidence: Math.max(0, Math.min(1, row.confidence)),
        last_observed_at:
          [prev?.last_observed_at, row.last_observed_at].filter(Boolean).sort().slice(-1)[0] ??
          row.last_observed_at,
      });
    }
  }
  return [...byName.values()].sort((x, y) => x.source_system.localeCompare(y.source_system));
}

function latestIso(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Merges two representations of the same logical asset from different sources.
 * Preserves strongest business criticality, highest per-source confidence, and unions collections.
 */
export function mergeBusinessAssets(primary: BusinessAsset, secondary: BusinessAsset): BusinessAsset {
  if (primary.tenant_id !== secondary.tenant_id) {
    throw new Error("Cannot merge assets across different tenants");
  }
  if (primary.asset_id !== secondary.asset_id) {
    throw new Error("mergeBusinessAssets requires matching asset_id");
  }

  const merged: BusinessAsset = {
    asset_id: primary.asset_id,
    tenant_id: primary.tenant_id,
    hostname: primary.hostname ?? secondary.hostname,
    ip_addresses: uniqueStrings([...primary.ip_addresses, ...secondary.ip_addresses]),
    mac_addresses: uniqueStrings([...primary.mac_addresses, ...secondary.mac_addresses]),
    cloud_ids: uniqueStrings([...primary.cloud_ids, ...secondary.cloud_ids]),
    owner: primary.owner ?? secondary.owner,
    department: primary.department ?? secondary.department,
    business_criticality: maxCriticality(
      primary.business_criticality,
      secondary.business_criticality,
    ),
    asset_type: primary.asset_type !== "unknown" ? primary.asset_type : secondary.asset_type,
    operating_system: primary.operating_system ?? secondary.operating_system,
    installed_software: uniqueStrings([...primary.installed_software, ...secondary.installed_software]),
    exposed_services: uniqueStrings([...primary.exposed_services, ...secondary.exposed_services]),
    vulnerabilities: [...primary.vulnerabilities, ...secondary.vulnerabilities].filter(
      (v, i, arr) => arr.findIndex((x) => x.id === v.id) === i,
    ),
    identities_with_access: uniqueStrings([
      ...primary.identities_with_access,
      ...secondary.identities_with_access,
    ]),
    compliance_scope: uniqueStrings([...primary.compliance_scope, ...secondary.compliance_scope]),
    tags: { ...secondary.tags, ...primary.tags },
    last_seen_at: latestIso(primary.last_seen_at, secondary.last_seen_at),
    source_systems: mergeSourceSystems(primary.source_systems, secondary.source_systems),
  };

  return businessAssetSchema.parse(merged);
}

/** Stable fingerprint for dedupe candidates within a tenant (hostname > primary cloud id > first IP). */
export function assetDedupeFingerprint(asset: Pick<BusinessAsset, "hostname" | "ip_addresses" | "cloud_ids">): string {
  const host = asset.hostname?.trim().toLowerCase();
  if (host) return `h:${host}`;
  const cloud = asset.cloud_ids[0]?.trim().toLowerCase();
  if (cloud) return `c:${cloud}`;
  const ip = asset.ip_addresses[0]?.trim().toLowerCase();
  if (ip) return `i:${ip}`;
  return `anon:${randomUUID()}`;
}

/**
 * Merges two tenant assets that describe the same endpoint but arrived with different `asset_id` values.
 * Canonical id is chosen deterministically so repeated merges converge.
 */
export function mergeBusinessAssetsDifferentIds(a: BusinessAsset, b: BusinessAsset): BusinessAsset {
  if (a.tenant_id !== b.tenant_id) {
    throw new Error("Cannot merge assets across different tenants");
  }
  const canonicalId = a.asset_id <= b.asset_id ? a.asset_id : b.asset_id;
  return mergeBusinessAssets({ ...a, asset_id: canonicalId }, { ...b, asset_id: canonicalId });
}

/** Group by {@link assetDedupeFingerprint} and merge rows (first row wins canonical id ordering). */
export function mergeDuplicateAssetGroup(assets: BusinessAsset[]): BusinessAsset {
  if (assets.length === 0) throw new Error("empty group");
  let acc = assets[0]!;
  for (let i = 1; i < assets.length; i += 1) {
    acc =
      acc.asset_id === assets[i]!.asset_id
        ? mergeBusinessAssets(acc, assets[i]!)
        : mergeBusinessAssetsDifferentIds(acc, assets[i]!);
  }
  return acc;
}
