import { getSupabaseAdminClient } from "@/lib/supabase";
import { getContextSummary } from "@/lib/token-optimization/contextSummaryService";
import type { ContextBundle } from "@/lib/token-optimization/types";

export type MonitoringContextBuilderInput = {
  tenantId: string;
  incidentId?: string;
  alertId?: string;
  taskType?: string;
};

export async function buildMonitoringContextBundle(
  input: MonitoringContextBuilderInput
): Promise<ContextBundle> {
  const supabase = getSupabaseAdminClient();
  const alertId = input.alertId ?? input.incidentId ?? null;
  const { data: alertRecord } = alertId
    ? await supabase
        .from("evidence_records")
        .select("id, finding_id, title, description, payload, created_at")
        .eq("tenant_id", input.tenantId)
        .eq("id", alertId)
        .maybeSingle()
    : { data: null };
  const summary = alertId
    ? await getContextSummary("evidence_record", alertId, "monitoring_alert_summary", input.tenantId)
    : null;
  const payload = (alertRecord?.payload ?? {}) as Record<string, unknown>;

  return {
    agentName: "monitoring",
    taskType: input.taskType ?? "monitoring_summary",
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    alertId: alertId ?? undefined,
    findingId: (alertRecord?.finding_id as string | null) ?? undefined,
    metadata: {
      source: "monitoringContextBuilder",
      hasSummary: Boolean(summary),
      alertCreatedAt: alertRecord?.created_at ?? null,
    },
    items: [
      { key: "alert_id", value: alertId, sensitivity: "low" },
      { key: "finding_id", value: alertRecord?.finding_id ?? null, sensitivity: "low" },
    ],
    data: {
      monitoring: {
        alertSummary: summary?.summaryText ?? alertRecord?.description ?? alertRecord?.title ?? null,
        correlationFields: payload?.correlation ?? payload?.metadata ?? null,
        timeline: payload?.timeline ?? null,
        severity: (payload?.severity as string | undefined) ?? null,
      },
    },
  };
}
