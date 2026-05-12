import type {
  DomainDiscoveryInput,
  OsintCollectionInput,
  VendorSecurityInput,
  ExternalAssetEvent,
  OsintIntelligenceEvent,
} from "./acquisitionTypes";

export interface DataAcquisitionProvider {
  discoverDomainAssets(input: DomainDiscoveryInput): Promise<ExternalAssetEvent[]>;
  collectOsintSignals(input: OsintCollectionInput): Promise<OsintIntelligenceEvent[]>;
  collectCredentialExposureSignals(domain: string): Promise<OsintIntelligenceEvent[]>;
  collectVendorSecuritySignals(input: VendorSecurityInput): Promise<OsintIntelligenceEvent[]>;
  fetchUrl(url: string): Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
}
