export type { ThreatIntelFeedAdapter, ThreatIntelFetchContext, ThreatIntelRawBatch } from "./threatIntelFeed.interface";
export { runFeedIngestion } from "./feedIngestionRunner";
export { createDefaultThreatIntelFeedRegistry, ThreatIntelFeedRegistry } from "./feedRegistry";
export {
  createMockAbuseChAdapter,
  createMockCisaKevAdapter,
  createMockMicrosoftStubAdapter,
} from "./mockThreatIntelAdapters";
export { threatIntelDedupKey, ThreatIntelCache } from "./threatIntelCache";
export {
  IOC_TYPES,
  exploitStatusSchema,
  THREAT_INTEL_FEEDS,
  threatIntelIngestionResultSchema,
  threatIntelItemSchema,
} from "./threatIntelItem.schema";
export type {
  ExploitStatus,
  IocType,
  ThreatIntelFeedId,
  ThreatIntelIngestionResult,
  ThreatIntelItem,
} from "./threatIntelItem.schema";
export {
  buildThreatIntelItem,
  normalizeCveId,
  normalizeDomain,
  normalizeIpv4,
  normalizeMd5,
  normalizeSha256,
  normalizeVendorRecord,
  type NormalizedThreatIntelInput,
} from "./threatIntelNormalizer";
