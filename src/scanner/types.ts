export type ScannerSeverity = "info" | "low" | "medium" | "high" | "critical";

export type RawScannerFinding = {
  externalId: string;
  severity: ScannerSeverity;
  category: string;
  title: string;
  description: string;
  cves: string[];
  metadata: Record<string, unknown>;
};

export type ScanConnectorResult = {
  scanner: string;
  scannerName: string;
  scannerType: "infra" | "code" | "monitoring" | "mock";
  findings: RawScannerFinding[];
};

export type ScanTargetInput = {
  tenantId: string;
  scanTargetId: string;
  targetType: string;
  targetValue: string;
};
