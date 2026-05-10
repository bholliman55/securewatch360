import type { ThreatIntelFeedAdapter } from "./threatIntelFeed.interface";
import type { ThreatIntelFeedId } from "./threatIntelItem.schema";
import { THREAT_INTEL_FEEDS } from "./threatIntelItem.schema";
import {
  createMockAbuseChAdapter,
  createMockCisaKevAdapter,
  createMockMicrosoftStubAdapter,
} from "./mockThreatIntelAdapters";

const noopAdapter = (feed_id: ThreatIntelFeedId, name: string): ThreatIntelFeedAdapter => ({
  feed_id,
  display_name: name,
  default_confidence_0_1: 0.7,
  async fetchRaw() {
    return { records: [] };
  },
});

/**
 * Registers feed adapters — defaults wire mocks for tests; production injects real HTTP clients.
 */
export class ThreatIntelFeedRegistry {
  private readonly adapters = new Map<ThreatIntelFeedId, () => ThreatIntelFeedAdapter>();

  constructor(seed?: Partial<Record<ThreatIntelFeedId, () => ThreatIntelFeedAdapter>>) {
    const defaults: Record<ThreatIntelFeedId, () => ThreatIntelFeedAdapter> = {
      cisa_kev: createMockCisaKevAdapter,
      abuse_ch: createMockAbuseChAdapter,
      microsoft_threat_intel_stub: createMockMicrosoftStubAdapter,
      nvd_cve: () => noopAdapter("nvd_cve", "NVD CVE"),
      osv: () => noopAdapter("osv", "OSV"),
      alienvault_otx: () => noopAdapter("alienvault_otx", "AlienVault OTX"),
      greynoise: () => noopAdapter("greynoise", "GreyNoise"),
      misp: () => noopAdapter("misp", "MISP"),
    };
    for (const id of THREAT_INTEL_FEEDS) {
      this.adapters.set(id, seed?.[id] ?? defaults[id]);
    }
  }

  register(feed_id: ThreatIntelFeedId, factory: () => ThreatIntelFeedAdapter): void {
    this.adapters.set(feed_id, factory);
  }

  createAdapter(feed_id: ThreatIntelFeedId): ThreatIntelFeedAdapter {
    const f = this.adapters.get(feed_id);
    if (!f) throw new Error(`unknown_threat_feed:${feed_id}`);
    return f();
  }

  listFeeds(): ThreatIntelFeedId[] {
    return [...THREAT_INTEL_FEEDS];
  }
}

export function createDefaultThreatIntelFeedRegistry(): ThreatIntelFeedRegistry {
  return new ThreatIntelFeedRegistry();
}
