import { BrightDataAcquisitionProvider } from "@/services/data-acquisition/BrightDataAcquisitionProvider";
import type { DataAcquisitionProvider } from "@/services/data-acquisition/DataAcquisitionProvider";
import type { ExternalDiscoveryInput, ExternalDiscoveryResult } from "./externalDiscoveryTypes";
import { normalizeToDiscoveredAsset } from "./externalDiscoveryNormalizer";

// Only collect public, passive, web-accessible intelligence.
// No intrusive scanning, no active port scanning, no authenticated probing.

export async function runExternalDiscoveryScan(
  input: ExternalDiscoveryInput,
  provider: DataAcquisitionProvider = new BrightDataAcquisitionProvider()
): Promise<ExternalDiscoveryResult> {
  const errors: string[] = [];
  const startedAt = new Date();

  let rawAssets: Awaited<ReturnType<typeof provider.discoverDomainAssets>> = [];
  try {
    rawAssets = await provider.discoverDomainAssets({
      scanId: input.scanId,
      clientId: input.clientId,
      domain: input.domain,
      includeSubdomains: input.includeSubdomains,
      includeDns: input.includeDns,
      includeCertificates: input.includeCertificates,
      includePublicEndpoints: input.includePublicEndpoints,
    });
  } catch (err) {
    errors.push(`Discovery failed: ${(err as Error).message}`);
    rawAssets = [];
  }

  const assets = rawAssets.map(normalizeToDiscoveredAsset);

  return {
    scanId: input.scanId,
    domain: input.domain,
    totalDiscovered: assets.length,
    dedupeCount: rawAssets.length - assets.length,
    assets,
    errors,
    completedAt: new Date(),
  };
}
