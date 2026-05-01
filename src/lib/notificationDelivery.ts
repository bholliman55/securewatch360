import type { NotificationSubscriptionRuleRow } from "@/lib/notificationSubscriptionRules";

export type DigestDeliveryAttempt = {
  channel: string;
  delivered: boolean;
  detail: string;
};

export function isNotificationDeliveryEnabled(): boolean {
  const v = process.env.NOTIFICATION_DELIVERY_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function parseEmailRecipients(): string[] {
  const raw = process.env.NOTIFICATION_DIGEST_EMAIL_TO?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}

/**
 * Sends digest notifications when outbound integrations are configured.
 * Email uses Resend (`RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, `NOTIFICATION_DIGEST_EMAIL_TO`).
 * Slack uses Incoming Webhooks (`SW360_SLACK_DIGEST_WEBHOOK_URL`).
 */
export async function deliverNotificationDigest(options: {
  rule: NotificationSubscriptionRuleRow;
  summaryLine: string;
  digestReason: string;
}): Promise<DigestDeliveryAttempt[]> {
  const attempts: DigestDeliveryAttempt[] = [];

  if (!isNotificationDeliveryEnabled()) {
    attempts.push({
      channel: options.rule.channel,
      delivered: false,
      detail: "NOTIFICATION_DELIVERY_ENABLED is not true",
    });
    return attempts;
  }

  const subject = `[SecureWatch360] Digest — ${options.rule.label || options.rule.id}`;
  const bodyText = `${options.summaryLine}\n\nReason: ${options.digestReason}\nTenant: ${options.rule.tenant_id}\nRule: ${options.rule.id}`;

  if (options.rule.channel === "email") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.NOTIFICATION_EMAIL_FROM?.trim();
    const recipients = parseEmailRecipients();
    if (!apiKey || !from || recipients.length === 0) {
      attempts.push({
        channel: "email",
        delivered: false,
        detail:
          "Missing RESEND_API_KEY, NOTIFICATION_EMAIL_FROM, or NOTIFICATION_DIGEST_EMAIL_TO",
      });
      return attempts;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject,
          text: bodyText,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        attempts.push({ channel: "email", delivered: false, detail: `Resend ${res.status}: ${t.slice(0, 200)}` });
        return attempts;
      }
      attempts.push({ channel: "email", delivered: true, detail: `sent to ${recipients.length} recipient(s)` });
    } catch (e) {
      attempts.push({
        channel: "email",
        delivered: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    return attempts;
  }

  if (options.rule.channel === "slack") {
    const webhook = process.env.SW360_SLACK_DIGEST_WEBHOOK_URL?.trim();
    if (!webhook) {
      attempts.push({
        channel: "slack",
        delivered: false,
        detail: "SW360_SLACK_DIGEST_WEBHOOK_URL not set",
      });
      return attempts;
    }
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*${subject}*\n${bodyText}`,
        }),
      });
      if (!res.ok) {
        attempts.push({
          channel: "slack",
          delivered: false,
          detail: `Webhook returned ${res.status}`,
        });
        return attempts;
      }
      attempts.push({ channel: "slack", delivered: true, detail: "posted to Slack webhook" });
    } catch (e) {
      attempts.push({
        channel: "slack",
        delivered: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    return attempts;
  }

  attempts.push({
    channel: options.rule.channel,
    delivered: false,
    detail: "External delivery not implemented for in_app in this build",
  });
  return attempts;
}
