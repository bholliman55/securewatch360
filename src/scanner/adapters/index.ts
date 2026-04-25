import type { TenantId } from "@/types";

/**
 * Shared adapter contracts for mock + future real scanners.
 */
export type ScannerAdapterId = "mock" | "nmap" | "zap" | "trivy" | "osv";
export type ScannerType = "mock" | "network" | "web" | "vulnerability";
export type TargetType =
  | "url"
  | "domain"
  | "hostname"
  | "ip"
  | "cidr"
  | "webapp"
  | "repo"
  | "cloud_account"
  | "container_image"
  | "package_manifest"
  | "dependency_manifest";

export type ScanContext = {
  tenantId: TenantId;
  scanTargetId: string;
  targetType: string;
  targetValue: string;
};

export type ScannerFinding = {
  severity: string;
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
};

export type ScannerRunResult = {
  scanner: ScannerAdapterId;
  scannerName: string;
  scannerType: ScannerType;
  findings: ScannerFinding[];
};

export type ScannerMetadata = {
  name: string;
  type: ScannerType;
  supportedTargetTypes: TargetType[];
  implemented: boolean;
};

export interface ScannerAdapter {
  readonly id: ScannerAdapterId;
  readonly metadata: ScannerMetadata;
  run(ctx: ScanContext): Promise<ScannerRunResult>;
}
