import type { ThreatIntelItem } from "./threatIntelItem.schema";
import { threatIntelItemSchema } from "./threatIntelItem.schema";

export function threatIntelDedupKey(item: Pick<ThreatIntelItem, "source_feed" | "ioc_type" | "ioc_value">): string {
  return `${item.source_feed}:${item.ioc_type}:${item.ioc_value.toLowerCase()}`;
}

/**
 * In-memory deduplicated index — swap for Redis + Postgres in production.
 */
export class ThreatIntelCache {
  private readonly byKey = new Map<string, ThreatIntelItem>();

  upsert(item: ThreatIntelItem): { duplicate: boolean; item: ThreatIntelItem } {
    const parsed = threatIntelItemSchema.parse(item);
    const key = threatIntelDedupKey(parsed);
    const existing = this.byKey.get(key);
    if (existing) {
      return { duplicate: true, item: existing };
    }
    this.byKey.set(key, parsed);
    return { duplicate: false, item: parsed };
  }

  getByDedupKey(key: string): ThreatIntelItem | undefined {
    return this.byKey.get(key);
  }

  linkToAssets(itemId: string, assetIds: string[]): ThreatIntelItem | undefined {
    const entry = [...this.byKey.values()].find((i) => i.item_id === itemId);
    if (!entry) return undefined;
    const merged = new Set([...entry.linked_asset_ids, ...assetIds]);
    const next = threatIntelItemSchema.parse({
      ...entry,
      linked_asset_ids: [...merged],
    });
    const key = threatIntelDedupKey(next);
    this.byKey.set(key, next);
    return next;
  }

  linkToFindings(itemId: string, findingIds: string[]): ThreatIntelItem | undefined {
    const entry = [...this.byKey.values()].find((i) => i.item_id === itemId);
    if (!entry) return undefined;
    const merged = new Set([...entry.linked_finding_ids, ...findingIds]);
    const next = threatIntelItemSchema.parse({
      ...entry,
      linked_finding_ids: [...merged],
    });
    const key = threatIntelDedupKey(next);
    this.byKey.set(key, next);
    return next;
  }

  list(): ThreatIntelItem[] {
    return [...this.byKey.values()];
  }

  clearForTests(): void {
    this.byKey.clear();
  }
}
