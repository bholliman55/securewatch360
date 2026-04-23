import type { ScannerFinding } from "./adapters";
import type { FindingStatus } from "@/lib/statuses";
import { calculatePriorityScore } from "@/lib/prioritization";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

type NormalizeInput = {
  tenantId: string;
  scanRunId: string;
  source: string;
  assetType: string;
  exposure: string;
  rawFindings: ScannerFinding[];
};

export type NormalizedFindingInsert = {
  tenant_id: string;
  scan_run_id: string;
  severity: FindingSeverity;
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  status: FindingStatus;
  asset_type: string;
  exposure: string;
  priority_score: number;
};

const allowedSeverities: FindingSeverity[] = ["info", "low", "medium", "high", "critical"];

function normalizeSeverity(value: string): FindingSeverity {
  const lower = value.toLowerCase();
  if (allowedSeverities.includes(lower as FindingSeverity)) {
    return lower as FindingSeverity;
  }
  return "medium";
}

/**
 * Converts scanner output into rows that match `public.findings`.
 */
export function normalizeFindings(input: NormalizeInput): NormalizedFindingInsert[] {
  return input.rawFindings.map((item) => {
    const severity = normalizeSeverity(item.severity);
    return {
      severity,
      asset_type: input.assetType,
      exposure: input.exposure,
      priority_score: calculatePriorityScore({
        severity,
        assetType: input.assetType,
        exposure: input.exposure,
      }),
      tenant_id: input.tenantId,
      scan_run_id: input.scanRunId,
      category: item.category,
      title: item.title,
      description: item.description,
      evidence: {
        source: input.source,
        ...item.evidence,
      },
      status: "open",
    };
  });
}
