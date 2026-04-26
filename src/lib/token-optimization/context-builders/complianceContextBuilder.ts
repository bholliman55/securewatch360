import { getSupabaseAdminClient } from "@/lib/supabase";
import { getContextSummary } from "@/lib/token-optimization/contextSummaryService";
import type { ContextBundle } from "@/lib/token-optimization/types";

export type ComplianceContextBuilderInput = {
  tenantId: string;
  findingId: string;
  scanRunId?: string;
  taskType?: string;
};

export async function buildComplianceContextBundle(
  input: ComplianceContextBuilderInput
): Promise<ContextBundle> {
  const supabase = getSupabaseAdminClient();
  const { data: finding } = await supabase
    .from("findings")
    .select("id, scan_run_id, severity, category, title, status")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.findingId)
    .maybeSingle();
  const { data: mappings } = await supabase
    .from("finding_control_mappings")
    .select("control_requirement_id, notes")
    .eq("tenant_id", input.tenantId)
    .eq("finding_id", input.findingId)
    .limit(8);
  const summary = await getContextSummary("finding", input.findingId, "compliance_evidence_summary", input.tenantId);

  return {
    agentName: "compliance",
    taskType: input.taskType ?? "evidence_summary",
    tenantId: input.tenantId,
    findingId: input.findingId,
    scanRunId: input.scanRunId ?? ((finding?.scan_run_id as string | null) ?? undefined),
    metadata: {
      source: "complianceContextBuilder",
      mappingCount: mappings?.length ?? 0,
      hasSummary: Boolean(summary),
    },
    items: [
      { key: "finding_id", value: input.findingId, sensitivity: "low" },
      {
        key: "control_requirement_ids",
        value: (mappings ?? []).map((row) => row.control_requirement_id).filter(Boolean),
        sensitivity: "low",
      },
    ],
    data: {
      compliance: {
        framework: null,
        control: (mappings ?? []).map((row) => row.control_requirement_id).filter(Boolean),
        evidence: summary?.summaryText ?? (mappings ?? []).map((row) => row.notes).filter(Boolean),
        status: finding?.status ?? null,
      },
      finding: {
        title: finding?.title ?? null,
        category: finding?.category ?? null,
        severity: finding?.severity ?? null,
      },
    },
  };
}
