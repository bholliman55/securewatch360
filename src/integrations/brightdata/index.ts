export type {
  Sw360BrightDataEvidenceInsert,
  Sw360ThreatIntelSignal,
} from "./brightDataSw360Schemas";

export { assertPublicInternetTargetUrl, assertPublicOsintSearchQuery, BrightDataPolicyError } from "./brightDataPublicSurfaceGuard";

export { BrightDataRateLimiter, BrightDataRateLimitExceededError, type BrightDataRateLimiterConfig } from "./brightDataRateLimiter";

export {
  BrightDataMcpClient,
  createUnconfiguredBrightDataMcpInvoker,
  defaultBrightDataMcpServerId,
  defaultBrightDataScrapeToolName,
  defaultBrightDataSearchToolName,
  isBrightDataMcpMockMode,
  newBrightDataTraceContext,
  type BrightDataMcpInvoker,
  type BrightDataMcpToolInvocation,
} from "./brightDataMcpClient";

export {
  normalizeScrapeToSignal,
  normalizeScreenshotToSignal,
  normalizeSearchResultsToSignals,
  refineSignalTypesForNewsAndBreach,
} from "./brightDataNormalizer";

export {
  persistBrightDataEvidenceRows,
  signalsToEvidenceInserts,
  type BrightDataEvidenceContext,
} from "./brightDataEvidenceCollector";

export {
  enrichSimulationWithBrightDataPublicIntel,
  type SimulationBrightDataLabAttachment,
} from "./brightDataSimulationEnricher";

export { BrightDataIntelligenceSource, type BrightDataIntelligenceSourceOptions } from "./brightDataSourceAdapter";

export { BrightDataClient } from "./brightDataClient";
export { getBrightDataConfig } from "./brightDataConfig";
export type {
  BrightDataConfig,
  BrightDataFetchOptions,
  BrightDataFetchResult,
  BrightDataSearchQuery,
  BrightDataSearchResult,
  BrightDataSearchResultItem,
  BrightDataScrapeResult,
  BrightDataScrapeTarget,
} from "./brightDataTypes";
export {
  BrightDataAuthError,
  BrightDataError,
  BrightDataRateLimitError,
  BrightDataTimeoutError,
  BrightDataUnavailableError,
  classifyBrightDataError,
} from "./brightDataErrors";
