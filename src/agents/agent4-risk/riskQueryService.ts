import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Finding } from "@/types/finding";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export interface RiskQueryInput {
  scanId: string;
  clientId?: string;
  severity?: FindingSeverity;
  limit?: number;
  tenantId: string;
}

export interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RiskQueryResult {
  scanId: string;
  totalFindings: number;
  bySeverity: SeverityBreakdown;
  topFindings: Finding[];
  completedAt: Date;
}

export async function runRiskQuery(input: RiskQueryInput): Promise<RiskQueryResult> {
  const client = getSupabaseAdminClient();

  // Query findings filtered by tenantId and optionally by severity
  let query = client
    .from("findings")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .order("created_at", { ascending: false });

  if (input.severity) {
    query = query.eq("severity", input.severity);
  }

  const limit = input.limit ?? 20;
  query = query.limit(limit);

  const { data: findings, error } = await query;

  if (error) {
    throw new Error(`Failed to query findings: ${error.message}`);
  }

  // Build severity breakdown for all findings in tenant (not just top ones)
  const breakdownQuery = client
    .from("findings")
    .select("severity", { count: "exact" })
    .eq("tenant_id", input.tenantId);

  const bySeverity: SeverityBreakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const { data: severityData, error: severityError } = await breakdownQuery;

  if (!severityError && severityData) {
    for (const record of severityData) {
      const severity = record.severity as FindingSeverity;
      if (severity in bySeverity) {
        bySeverity[severity]++;
      }
    }
  }

  const topFindings = (findings || []) as Finding[];
  const totalFindings = topFindings.length;

  return {
    scanId: input.scanId,
    totalFindings,
    bySeverity,
    topFindings,
    completedAt: new Date(),
  };
}
