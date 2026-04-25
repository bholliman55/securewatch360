import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import type { NotificationSubscriptionRuleRow } from "@/lib/notificationSubscriptionRules";

type DigestCheck = { shouldRun: boolean; reason: string };

function shouldRunDigest(
  interval: "hourly" | "daily" | "weekly",
  now: Date
): DigestCheck {
  const hour = now.getUTCHours();
  const day = now.getUTCDay();
  if (interval === "hourly") {
    return { shouldRun: true, reason: "hourly" };
  }
  if (interval === "daily") {
    if (hour === 0) {
      return { shouldRun: true, reason: "daily@utc_midnight" };
    }
    return { shouldRun: false, reason: "daily_skipped_not_midnight_utc" };
  }
  if (interval === "weekly") {
    if (day === 0 && hour === 0) {
      return { shouldRun: true, reason: "weekly_sunday_utc_midnight" };
    }
    return { shouldRun: false, reason: "weekly_skipped" };
  }
  return { shouldRun: false, reason: "unknown_interval" };
}

/**
 * Hourly: evaluates digest-enabled rules and records stub "would send" delivery
 * (no SendGrid/Slack unless configured). Proof lives in audit_logs + evidence_records.
 */
export const notificationDigest = inngest.createFunction(
  { id: "notification-digest", retries: 1 },
  { cron: "5 * * * *" },
  async () => {
    const supabase = getSupabaseAdminClient();
    const now = new Date();
    const nowIso = now.toISOString();

    const { data, error } = await supabase
      .from("notification_subscription_rules")
      .select(
        "id, tenant_id, user_id, label, min_severity, channel, digest_interval, enabled, created_at, updated_at"
      )
      .eq("enabled", true)
      .in("digest_interval", ["hourly", "daily", "weekly"]);

    if (error) {
      throw new Error(error.message);
    }

    const rules = (data ?? []) as unknown as NotificationSubscriptionRuleRow[];
    let stubsWritten = 0;

    for (const rule of rules) {
      const interval = rule.digest_interval;
      if (interval === "off") {
        continue;
      }
      const check = shouldRunDigest(interval, now);
      if (!check.shouldRun) {
        continue;
      }

      const summary = `Notification digest stub: would send for channel=${rule.channel} (min_severity >= ${rule.min_severity}, ${check.reason}).`;
      await writeAuditLog({
        userId: null,
        tenantId: rule.tenant_id,
        entityType: "notification",
        entityId: rule.id,
        action: "notification.digest.stub",
        summary,
        payload: {
          systemActor: true,
          channel: rule.channel,
          minSeverity: rule.min_severity,
          digestInterval: rule.digest_interval,
          label: rule.label,
          targetUserId: rule.user_id,
          proof: "stub_no_external_delivery",
        },
      });

      const { error: evError } = await supabase.from("evidence_records").insert({
        tenant_id: rule.tenant_id,
        scan_run_id: null,
        finding_id: null,
        control_framework: "internal",
        control_id: "NOTIFICATION-001",
        evidence_type: "notification_digest",
        title: "Notification digest (stub delivery record)",
        description:
          "Placeholder evidence that the digest job ran; real email/Slack delivery requires integration env.",
        payload: {
          subscriptionRuleId: rule.id,
          channel: rule.channel,
          minSeverity: rule.min_severity,
          digestInterval: rule.digest_interval,
          stubbedAt: nowIso,
        },
      });
      if (evError) {
        console.error("[notification-digest] evidence insert failed", {
          ruleId: rule.id,
          message: evError.message,
        });
      }

      stubsWritten += 1;
    }

    return {
      ok: true,
      rulesConsidered: rules.length,
      stubsWritten,
    };
  }
);
