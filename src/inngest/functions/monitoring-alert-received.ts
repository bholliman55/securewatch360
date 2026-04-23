import { getSupabaseAdminClient } from "@/lib/supabase";
import { calculatePriorityScore, inferExposure } from "@/lib/prioritization";
import { FINDING_STATUSES, SCAN_RUN_STATUSES } from "@/lib/statuses";
import type { InngestEventMap } from "@/types";
import { inngest } from "../client";

type MonitoringAlertReceived = InngestEventMap["securewatch/monitoring.alert.received"];

function deriveAssetType(targetValue?: string): string {
  const value = (targetValue ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value.startsWith("http://") || value.startsWith("https://")) return "url";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return "ip";
  if (value.includes("/")) return "cidr";
  return "hostname";
}

/**
 * v1 alert-driven workflow:
 * 1) enrich incoming alert data
 * 2) create a finding when alert is actionable
 */
export const monitoringAlertReceived = inngest.createFunction(
  { id: "securewatch-monitoring-alert-received", name: "SecureWatch: handle monitoring alert" },
  { event: "securewatch/monitoring.alert.received" as const },
  async ({ event, step, runId }) => {
    const payload: MonitoringAlertReceived = event.data;
    const supabase = getSupabaseAdminClient();

    const createdRun = await step.run("create-alert-run", async () => {
      const { data, error } = await supabase
        .from("scan_runs")
        .insert({
          tenant_id: payload.tenantId,
          scan_target_id: null,
          workflow_run_id: runId,
          status: SCAN_RUN_STATUSES[0], // queued
          scanner_name: "Monitoring Agent",
          scanner_type: "monitoring",
          target_snapshot: {
            source: payload.source,
            alertType: payload.alertType,
            targetValue: payload.targetValue ?? null,
          },
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Could not create alert run: ${error?.message ?? "unknown error"}`);
      }

      return data;
    });

    const scanRunId = createdRun.id;

    try {
      await step.run("mark-alert-run-running", async () => {
        await supabase
          .from("scan_runs")
          .update({
            status: SCAN_RUN_STATUSES[1], // running
            started_at: new Date().toISOString(),
          })
          .eq("id", scanRunId);
      });

      const enriched = await step.run("enrich-alert", async () => {
        const normalizedSeverity = payload.severity.toLowerCase() as MonitoringAlertReceived["severity"];
        const shouldCreateFinding =
          payload.createFinding ?? ["medium", "high", "critical"].includes(normalizedSeverity);

        return {
          normalizedSeverity,
          shouldCreateFinding,
          summary: {
            source: payload.source,
            alertType: payload.alertType,
            title: payload.title,
          },
        };
      });

      let findingId: string | null = null;
      if (enriched.shouldCreateFinding) {
        findingId = await step.run("create-finding-if-needed", async () => {
          const assetType = deriveAssetType(payload.targetValue);
          const exposure = inferExposure(assetType, payload.targetValue ?? "");
          const { data, error } = await supabase
            .from("findings")
            .insert({
              tenant_id: payload.tenantId,
              scan_run_id: scanRunId,
              severity: enriched.normalizedSeverity,
              asset_type: assetType,
              exposure,
              priority_score: calculatePriorityScore({
                severity: enriched.normalizedSeverity,
                assetType,
                exposure,
              }),
              category: "monitoring_alert",
              title: payload.title,
              description: payload.description ?? `Alert received from ${payload.source}`,
              evidence: {
                source: payload.source,
                alertType: payload.alertType,
                targetValue: payload.targetValue ?? null,
                metadata: payload.metadata ?? {},
              },
              status: FINDING_STATUSES[0], // open
            })
            .select("id")
            .single();

          if (error || !data) {
            throw new Error(`Could not create finding: ${error?.message ?? "unknown error"}`);
          }

          return data.id;
        });
      }

      await step.run("mark-alert-run-completed", async () => {
        await supabase
          .from("scan_runs")
          .update({
            status: SCAN_RUN_STATUSES[2], // completed
            completed_at: new Date().toISOString(),
            error_message: null,
            result_summary: {
              findingCreated: Boolean(findingId),
              findingId,
              source: payload.source,
              alertType: payload.alertType,
              severity: enriched.normalizedSeverity,
            },
          })
          .eq("id", scanRunId);
      });

      return {
        ok: true,
        workflowRunId: runId,
        scanRunId,
        findingCreated: Boolean(findingId),
        findingId,
        source: payload.source,
        alertType: payload.alertType,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown alert workflow failure";

      await step.run("mark-alert-run-failed", async () => {
        await supabase
          .from("scan_runs")
          .update({
            status: SCAN_RUN_STATUSES[3], // failed
            completed_at: new Date().toISOString(),
            error_message: message,
          })
          .eq("id", scanRunId);
      });

      throw new Error(`securewatch monitoring alert workflow failed: ${message}`);
    }
  }
);
