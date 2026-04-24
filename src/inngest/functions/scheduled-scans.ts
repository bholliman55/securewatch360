import { getSupabaseAdminClient } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { inngest } from "../client";

type ScanScheduleRow = {
  id: string;
  tenant_id: string;
  scan_target_id: string | null;
  scope: "tenant" | "target";
};

type ScanTargetRow = {
  id: string;
};

async function enqueueScheduledScans(frequency: "daily" | "weekly", workflowRunId: string) {
  const supabase = getSupabaseAdminClient();
  const triggeredAt = new Date().toISOString();

  const { data: schedules, error: schedulesError } = await supabase
    .from("scan_schedules")
    .select("id, tenant_id, scan_target_id, scope")
    .eq("enabled", true)
    .eq("frequency", frequency);

  if (schedulesError) {
    throw new Error(`Could not load scan schedules: ${schedulesError.message}`);
  }

  const rows = (schedules ?? []) as ScanScheduleRow[];
  if (rows.length === 0) {
    return { schedulesProcessed: 0, scansEnqueued: 0 };
  }

  const dedupedTargets = new Set<string>();
  const events: Array<{ tenantId: string; scanTargetId: string }> = [];

  for (const schedule of rows) {
    if (schedule.scope === "target" && schedule.scan_target_id) {
      const key = `${schedule.tenant_id}:${schedule.scan_target_id}`;
      if (!dedupedTargets.has(key)) {
        dedupedTargets.add(key);
        events.push({
          tenantId: schedule.tenant_id,
          scanTargetId: schedule.scan_target_id,
        });
      }
      continue;
    }

    const { data: tenantTargets, error: tenantTargetsError } = await supabase
      .from("scan_targets")
      .select("id")
      .eq("tenant_id", schedule.tenant_id)
      .eq("status", "active");

    if (tenantTargetsError) {
      console.error("[scheduled-scan] failed loading tenant targets", {
        scheduleId: schedule.id,
        tenantId: schedule.tenant_id,
        error: tenantTargetsError.message,
      });
      continue;
    }

    for (const target of (tenantTargets ?? []) as ScanTargetRow[]) {
      const key = `${schedule.tenant_id}:${target.id}`;
      if (!dedupedTargets.has(key)) {
        dedupedTargets.add(key);
        events.push({
          tenantId: schedule.tenant_id,
          scanTargetId: target.id,
        });
      }
    }
  }

  for (const event of events) {
    await inngest.send({
      name: "securewatch/scan.requested",
      data: {
        tenantId: event.tenantId,
        scanTargetId: event.scanTargetId,
      },
    });

    await writeAuditLog({
      userId: null,
      tenantId: event.tenantId,
      entityType: "scan",
      entityId: event.scanTargetId,
      action: "scan.triggered",
      summary: `Scheduled ${frequency} scan triggered`,
      payload: {
        triggerType: "scheduled",
        frequency,
        scanTargetId: event.scanTargetId,
        workflowRunId,
      },
    });
  }

  await supabase
    .from("scan_schedules")
    .update({ last_triggered_at: triggeredAt, updated_at: triggeredAt })
    .eq("enabled", true)
    .eq("frequency", frequency);

  return {
    schedulesProcessed: rows.length,
    scansEnqueued: events.length,
    workflowRunId,
  };
}

/**
 * UTC daily schedule for auto-scans.
 * Cron: 02:00 UTC every day.
 */
export const scheduledDailyScans = inngest.createFunction(
  { id: "securewatch-scheduled-daily-scans", name: "SecureWatch: scheduled daily scans" },
  { cron: "0 2 * * *" },
  async ({ step, runId }) => {
    return step.run("enqueue-daily-scan-events", async () => {
      return enqueueScheduledScans("daily", runId);
    });
  }
);

/**
 * UTC weekly schedule for auto-scans.
 * Cron: 03:00 UTC every Monday.
 */
export const scheduledWeeklyScans = inngest.createFunction(
  { id: "securewatch-scheduled-weekly-scans", name: "SecureWatch: scheduled weekly scans" },
  { cron: "0 3 * * 1" },
  async ({ step, runId }) => {
    return step.run("enqueue-weekly-scan-events", async () => {
      return enqueueScheduledScans("weekly", runId);
    });
  }
);
