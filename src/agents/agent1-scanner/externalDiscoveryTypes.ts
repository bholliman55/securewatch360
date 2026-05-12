export interface ExternalDiscoveryInput {
  scanId: string;
  clientId?: string;
  domain: string;
  includeSubdomains?: boolean;
  includeDns?: boolean;
  includeCertificates?: boolean;
  includePublicEndpoints?: boolean;
}

export interface DiscoveredAsset {
  scanId: string;
  clientId?: string;
  domain: string;
  assetType: string;
  assetValue: string;
  source: string;
  confidence: number;
  riskHint?: string;
  discoveredAt: Date;
  raw?: unknown;
}

export interface ExternalDiscoveryResult {
  scanId: string;
  domain: string;
  totalDiscovered: number;
  dedupeCount: number;
  assets: DiscoveredAsset[];
  errors: string[];
  completedAt: Date;
}
