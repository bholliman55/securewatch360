import type { ExternalAssetEvent } from "@/services/data-acquisition/acquisitionTypes";
import type { DiscoveredAsset } from "./externalDiscoveryTypes";

export function normalizeToDiscoveredAsset(event: ExternalAssetEvent): DiscoveredAsset {
  return {
    scanId: event.scanId,
    clientId: event.clientId,
    domain: event.domain,
    assetType: event.assetType,
    assetValue: event.assetValue,
    source: event.source,
    confidence: event.confidence,
    riskHint: event.riskHint,
    discoveredAt: event.discoveredAt,
    raw: event.raw,
  };
}
