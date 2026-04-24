import type { RawScannerFinding } from "@/scanner/types";

type NormalizeArgs = {
  tenantId: string;
  scanRunId: string;
  source: string;
  assetType: string;
  exposure: "internet" | "external" | "partner" | "internal" | "isolated" | "unknown";
  rawFindings: RawScannerFinding[];
};

export type NormalizedFindingInsert = {
  tenant_id: string;
  scan_run_id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  status: "open";
  asset_type: string;
  exposure: NormalizeArgs["exposure"];
};

export function normalizeFindings(args: NormalizeArgs): NormalizedFindingInsert[] {
  return args.rawFindings.map((finding) => ({
    tenant_id: args.tenantId,
    scan_run_id: args.scanRunId,
    severity: finding.severity,
    category: finding.category || "uncategorized",
    title: finding.title,
    description: finding.description,
    evidence: {
      source: args.source,
      externalId: finding.externalId,
      cves: finding.cves,
      metadata: finding.metadata,
    },
    status: "open",
    asset_type: args.assetType,
    exposure: args.exposure,
  }));
}
