import { describe, expect, it } from "vitest";
import { runFeedIngestion } from "./feedIngestionRunner";
import { createDefaultThreatIntelFeedRegistry } from "./feedRegistry";
import { threatIntelDedupKey, ThreatIntelCache } from "./threatIntelCache";
import { createMockCisaKevAdapter } from "./mockThreatIntelAdapters";
import { buildThreatIntelItem, normalizeCveId } from "./threatIntelNormalizer";

describe("threat-intel ingestion", () => {
  it("normalizes CVE ids and ingests mock CISA KEV", async () => {
    expect(normalizeCveId("cve-2024-12345")).toBe("CVE-2024-12345");
    const cache = new ThreatIntelCache();
    const adapter = createMockCisaKevAdapter();
    const first = await runFeedIngestion({ adapter, cache });
    expect(first.inserted).toBe(1);
    expect(first.duplicates).toBe(0);
    const second = await runFeedIngestion({ adapter, cache });
    expect(second.inserted).toBe(0);
    expect(second.duplicates).toBe(1);
  });

  it("dedupes identical IOC keys across runs", async () => {
    const cache = new ThreatIntelCache();
    const reg = createDefaultThreatIntelFeedRegistry();
    const abuse = reg.createAdapter("abuse_ch");
    await runFeedIngestion({ adapter: abuse, cache });
    await runFeedIngestion({ adapter: abuse, cache });
    const keys = cache.list().map((i) => threatIntelDedupKey(i));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("links threat intel to assets and findings", () => {
    const item = buildThreatIntelItem({
      source_feed: "nvd_cve",
      confidence_0_1: 0.9,
      observed_at: "2024-01-01T00:00:00.000Z",
      ioc_type: "cve",
      ioc_value: "CVE-2023-44487",
      cve_id: "CVE-2023-44487",
      raw_reference: "https://nvd.nist.gov/",
    });
    const cache = new ThreatIntelCache();
    cache.upsert(item);
    const linked = cache.linkToAssets(item.item_id, ["asset-1"]);
    expect(linked?.linked_asset_ids).toContain("asset-1");
    const linked2 = cache.linkToFindings(item.item_id, ["finding-9"]);
    expect(linked2?.linked_finding_ids).toContain("finding-9");
  });
});
