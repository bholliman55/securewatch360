export type AssetType =
  | "subdomain"
  | "url"
  | "login_page"
  | "admin_portal"
  | "ip_address"
  | "certificate"
  | "cloud_storage"
  | "technology_fingerprint"
  | "open_port"
  | "api_endpoint"
  | "unknown";

export type OsintEventType =
  | "credential_exposure"
  | "breach_reference"
  | "paste_site_mention"
  | "exploit_chatter"
  | "vulnerability_mention"
  | "compromised_account"
  | "vendor_advisory"
  | "risky_page"
  | "unknown";

export type IntelligenceSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ConfidenceScore = number; // 0.0 – 1.0

export interface ExternalAssetEvent {
  scanId: string;
  clientId?: string;
  domain: string;
  assetType: AssetType;
  assetValue: string;
  source: string;
  confidence: ConfidenceScore;
  riskHint?: string;
  discoveredAt: Date;
  raw?: unknown;
}

export interface OsintIntelligenceEvent {
  scanId?: string;
  clientId?: string;
  domain: string;
  companyName?: string;
  eventType: OsintEventType;
  severity: IntelligenceSeverity;
  confidence: ConfidenceScore;
  sourceCategory: string;
  evidenceUrl?: string;
  redactedPreview?: string;
  firstSeen?: Date;
  lastSeen?: Date;
  raw?: unknown;
}

export interface DomainDiscoveryInput {
  scanId: string;
  clientId?: string;
  domain: string;
  includeSubdomains?: boolean;
  includeDns?: boolean;
  includeCertificates?: boolean;
  includePublicEndpoints?: boolean;
}

export interface OsintCollectionInput {
  clientId?: string;
  domain: string;
  companyName?: string;
  knownEmails?: string[];
  scanId?: string;
}

export interface VendorSecurityInput {
  vendorName: string;
  domain?: string;
}
