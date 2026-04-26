import { getSupabaseAdminClient } from "@/lib/supabase";
import { getContextSummary } from "@/lib/token-optimization/contextSummaryService";
import type { ContextBundle } from "@/lib/token-optimization/types";

export type RemediationContextBuilderInput = {
  tenantId: string;
  findingId: string;
  remediationActionId?: string;
  scanRunId?: string;
  taskType?: string;
};

export async function buildRemediationContextBundle(
  input: RemediationContextBuilderInput
): Promise<ContextBundle> {
  const supabase = getSupabaseAdminClient();
  const { data: finding } = await supabase
    .from("findings")
    .select("id, scan_run_id, severity, category, title, status, asset_type, exposure")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.findingId)
    .maybeSingle();
  const actionQuery = supabase
    .from("remediation_actions")
    .select("id, action_type, action_status, execution_mode, execution_status, approval_status, notes")
    .eq("tenant_id", input.tenantId)
    .eq("finding_id", input.findingId)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: latestAction } = input.remediationActionId
    ? await actionQuery.eq("id", input.remediationActionId).maybeSingle()
    : await actionQuery.maybeSingle();
  const summary = await getContextSummary(
    "remediation_action",
    (latestAction?.id as string | null) ?? input.findingId,
    "remediation_recommendation",
    input.tenantId
  );

  return {
    agentName: "remediation",
    taskType: input.taskType ?? "remediation_recommendation_wording",
    tenantId: input.tenantId,
    findingId: input.findingId,
    scanRunId: input.scanRunId ?? ((finding?.scan_run_id as string | null) ?? undefined),
    metadata: {
      source: "remediationContextBuilder",
      remediationActionId: latestAction?.id ?? null,
      hasSummary: Boolean(summary),
    },
    items: [
      { key: "finding_id", value: input.findingId, sensitivity: "low" },
      { key: "remediation_action_id", value: latestAction?.id ?? null, sensitivity: "low" },
      { key: "scan_run_id", value: input.scanRunId ?? finding?.scan_run_id ?? null, sensitivity: "low" },
    ],
    data: {
      finding: {
        severity: finding?.severity ?? null,
        category: finding?.category ?? null,
        title: finding?.title ?? null,
        exposure: finding?.exposure ?? null,
        assetType: finding?.asset_type ?? null,
        status: finding?.status ?? null,
      },
      remediation: {
        actionType: latestAction?.action_type ?? null,
        actionStatus: latestAction?.action_status ?? null,
        executionMode: latestAction?.execution_mode ?? null,
        executionStatus: latestAction?.execution_status ?? null,
        approvalStatus: latestAction?.approval_status ?? null,
        recommendationSummary: summary?.summaryText ?? null,
        notes: latestAction?.notes ?? null,
      },
    },
  };
}
