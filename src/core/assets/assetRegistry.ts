import type { BusinessAsset } from "./asset.schema";
import { businessAssetSchema } from "./asset.schema";
import { assetDedupeFingerprint, mergeBusinessAssets, mergeBusinessAssetsDifferentIds } from "./assetMerger";

type RegistryKey = `${string}::${string}`;

function key(tenantId: string, assetId: string): RegistryKey {
  return `${tenantId}::${assetId}` as RegistryKey;
}

function fpKey(tenantId: string, fingerprint: string): string {
  return `${tenantId}::${fingerprint}`;
}

/**
 * Tenant-scoped asset inventory. Supports merging duplicate business objects keyed by stable fingerprint.
 */
export class AssetRegistry {
  private readonly byId = new Map<RegistryKey, BusinessAsset>();
  private readonly fingerprintToCanonicalId = new Map<string, string>();

  clearForTests(): void {
    this.byId.clear();
    this.fingerprintToCanonicalId.clear();
  }

  /** Upsert by `asset_id` — merges with existing row for the same id. */
  upsert(asset: BusinessAsset): BusinessAsset {
    const parsed = businessAssetSchema.parse(asset);
    const k = key(parsed.tenant_id, parsed.asset_id);
    const prev = this.byId.get(k);
    if (prev) {
      const merged = mergeBusinessAssets(prev, parsed);
      this.byId.set(k, merged);
      return merged;
    }
    this.byId.set(k, parsed);
    return parsed;
  }

  /**
   * Upsert while collapsing duplicates that share the same hostname / primary cloud id / first IP fingerprint.
   */
  upsertMergeByFingerprint(asset: BusinessAsset): BusinessAsset {
    const parsed = businessAssetSchema.parse(asset);
    const fp = fpKey(parsed.tenant_id, assetDedupeFingerprint(parsed));
    const canonicalId = this.fingerprintToCanonicalId.get(fp);

    if (canonicalId && canonicalId !== parsed.asset_id) {
      const existing = this.byId.get(key(parsed.tenant_id, canonicalId));
      if (existing) {
        const merged = mergeBusinessAssetsDifferentIds(existing, parsed);
        this.byId.set(key(parsed.tenant_id, merged.asset_id), merged);
        this.fingerprintToCanonicalId.set(fp, merged.asset_id);
        if (canonicalId !== merged.asset_id) {
          this.byId.delete(key(parsed.tenant_id, canonicalId));
        }
        if (parsed.asset_id !== merged.asset_id) {
          this.byId.delete(key(parsed.tenant_id, parsed.asset_id));
        }
        return merged;
      }
    }

    const k = key(parsed.tenant_id, parsed.asset_id);
    const prev = this.byId.get(k);
    const next = prev ? mergeBusinessAssets(prev, parsed) : parsed;
    this.byId.set(key(next.tenant_id, next.asset_id), next);
    this.fingerprintToCanonicalId.set(fp, next.asset_id);
    return next;
  }

  get(tenantId: string, assetId: string): BusinessAsset | undefined {
    return this.byId.get(key(tenantId, assetId));
  }

  listTenantAssets(tenantId: string): BusinessAsset[] {
    const prefix = `${tenantId}::`;
    return [...this.byId.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v)
      .sort((a, b) => a.asset_id.localeCompare(b.asset_id));
  }
}
