import type { ThreatIntelFeedAdapter } from "./threatIntelFeed.interface";
import type { ThreatIntelFetchContext } from "./threatIntelFeed.interface";
import type { ThreatIntelIngestionResult, ThreatIntelItem } from "./threatIntelItem.schema";
import { threatIntelIngestionResultSchema } from "./threatIntelItem.schema";
import type { ThreatIntelCache } from "./threatIntelCache";
import { buildThreatIntelItem, normalizeVendorRecord } from "./threatIntelNormalizer";

/**
 * Fetches raw rows, normalizes to `ThreatIntelItem`, dedupes via cache.
 */
export async function runFeedIngestion(args: {
  adapter: ThreatIntelFeedAdapter;
  cache: ThreatIntelCache;
  ctx?: ThreatIntelFetchContext;
}): Promise<ThreatIntelIngestionResult> {
  const { adapter, cache, ctx } = args;
  const errors: string[] = [];
  const item_ids: string[] = [];
  let inserted = 0;
  let duplicates = 0;

  try {
    const batch = await adapter.fetchRaw(ctx ?? {});
    const max = ctx?.max_records ?? 500;
    const slice = batch.records.slice(0, max);
    for (const raw of slice) {
      if (typeof raw !== "object" || raw === null) {
        errors.push("skip_non_object_record");
        continue;
      }
      const inputs = normalizeVendorRecord({
        feed_id: adapter.feed_id,
        default_confidence_0_1: adapter.default_confidence_0_1,
        record: raw as Record<string, unknown>,
      });
      for (const input of inputs) {
        let item: ThreatIntelItem;
        try {
          item = buildThreatIntelItem(input);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "build_item_failed");
          continue;
        }
        const { duplicate, item: stored } = cache.upsert(item);
        if (duplicate) duplicates += 1;
        else inserted += 1;
        item_ids.push(stored.item_id);
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "fetch_failed");
  }

  return threatIntelIngestionResultSchema.parse({
    feed_id: adapter.feed_id,
    inserted,
    duplicates,
    item_ids,
    errors,
  });
}
