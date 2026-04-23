import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { InngestEventMap } from "@/types";
import { inngest } from "../client";

type RemediationExecutionCompletedEvent = InngestEventMap["securewatch/remediation.execution.completed"];

export const postRemediationRevalidationRequested = inngest.createFunction(
  {
    id: "securewatch-post-remediation-revalidation",
    name: "SecureWatch: queue post-remediation revalidation scan",
  },
  { event: "securewatch/remediation.execution.completed" as const },
  async ({ event, step, runId }) => {
    const payload: RemediationExecutionCompletedEvent = event.data;
    const supabase = getSupabaseAdminClient();

    const resolvedTarget = await step.run("resolve-scan-target", async () => {
      const { data: remediation, error: remediationError } = await supabase
        .from("remediation_actions")
        .select("id, tenant_id, finding_id")
        .eq("id", payload.remediationActionId)
        .eq("tenant_id", payload.tenantId)
        .single();
      if (remediationError || !remediation) {
        throw new Error(remediationError?.message ?? "Remediation action not found");
      }

      const { data: finding, error: findingError } = await supabase
        .from("findings")
        .select("id, scan_run_id")
        .eq("id", remediation.finding_id)
        .eq("tenant_id", payload.tenantId)
        .single();
      if (findingError || !finding) {
        throw new Error(findingError?.message ?? "Finding not found");
      }

      if (!finding.scan_run_id) {
        return { scanTargetId: null as string | null, sourceScanRunId: null as string | null };
      }

      const { data: sourceRun, error: runError } = await supabase
        .from("scan_runs")
        .select("id, scan_target_id")
        .eq("id", finding.scan_run_id)
        .single();
      if (runError || !sourceRun) {
        throw new Error(runError?.message ?? "Source scan run not found");
      }

      return {
        scanTargetId: sourceRun.scan_target_id as string | null,
        sourceScanRunId: sourceRun.id as string,
      };
    });

    if (!resolvedTarget.scanTargetId) {
      await step.run("audit-no-target", async () => {
        await writeAuditLog({
          userId: null,
          tenantId: payload.tenantId,
          entityType: "remediation_action",
          entityId: payload.remediationActionId,
          action: "scan.revalidation.skipped",
          summary: "Skipped post-remediation revalidation: no scan target available",
          payload: {
            remediationActionId: payload.remediationActionId,
            findingId: payload.findingId,
            workflowRunId: runId,
          },
        });
      });

      return {
        ok: true,
        queued: false,
        reason: "no_scan_target",
        remediationActionId: payload.remediationActionId,
      };
    }

    await step.run("send-revalidation-scan-request", async () => {
      await inngest.send({
        name: "securewatch/scan.requested",
        data: {
          tenantId: payload.tenantId,
          scanTargetId: resolvedTarget.scanTargetId as string,
        },
      });
    });

    await step.run("audit-revalidation-queued", async () => {
      await writeAuditLog({
        userId: null,
        tenantId: payload.tenantId,
        entityType: "scan",
        entityId: resolvedTarget.scanTargetId as string,
        action: "scan.triggered",
        summary: "Post-remediation revalidation scan triggered",
        payload: {
          triggerType: "post_remediation",
          remediationActionId: payload.remediationActionId,
          findingId: payload.findingId,
          sourceScanRunId: resolvedTarget.sourceScanRunId,
          workflowRunId: runId,
        },
      });
    });

    return {
      ok: true,
      queued: true,
      remediationActionId: payload.remediationActionId,
      findingId: payload.findingId,
      scanTargetId: resolvedTarget.scanTargetId,
      sourceScanRunId: resolvedTarget.sourceScanRunId,
    };
  }
);
