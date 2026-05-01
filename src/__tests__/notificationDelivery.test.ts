import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  deliverNotificationDigest,
  isNotificationDeliveryEnabled,
} from "@/lib/notificationDelivery";
import type { NotificationSubscriptionRuleRow } from "@/lib/notificationSubscriptionRules";

const baseRule = (): NotificationSubscriptionRuleRow => ({
  id: "rule-1",
  tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user_id: null,
  label: "Test rule",
  min_severity: "high",
  channel: "email",
  digest_interval: "hourly",
  enabled: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe("notificationDelivery", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = { ...prev };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("isNotificationDeliveryEnabled respects NOTIFICATION_DELIVERY_ENABLED", () => {
    process.env.NOTIFICATION_DELIVERY_ENABLED = "true";
    expect(isNotificationDeliveryEnabled()).toBe(true);
    process.env.NOTIFICATION_DELIVERY_ENABLED = "false";
    expect(isNotificationDeliveryEnabled()).toBe(false);
  });

  it("returns not delivered when NOTIFICATION_DELIVERY_ENABLED is off", async () => {
    process.env.NOTIFICATION_DELIVERY_ENABLED = "false";
    const r = await deliverNotificationDigest({
      rule: baseRule(),
      summaryLine: "s",
      digestReason: "hourly",
    });
    expect(r[0]?.delivered).toBe(false);
    expect(r[0]?.detail).toContain("NOTIFICATION_DELIVERY_ENABLED");
  });

  it("sends Resend email when configured", async () => {
    process.env.NOTIFICATION_DELIVERY_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.NOTIFICATION_EMAIL_FROM = "noreply@example.com";
    process.env.NOTIFICATION_DIGEST_EMAIL_TO = "ops@example.com";

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "em_1" }), { status: 200 })
    );

    const r = await deliverNotificationDigest({
      rule: baseRule(),
      summaryLine: "digest summary",
      digestReason: "hourly",
    });

    expect(r[0]?.delivered).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
        }),
      })
    );
  });

  it("posts Slack webhook when configured", async () => {
    process.env.NOTIFICATION_DELIVERY_ENABLED = "true";
    process.env.SW360_SLACK_DIGEST_WEBHOOK_URL = "https://hooks.slack.com/services/xxx/yyy/zzz";

    vi.mocked(fetch).mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const rule = baseRule();
    rule.channel = "slack";

    const r = await deliverNotificationDigest({
      rule,
      summaryLine: "slack digest",
      digestReason: "hourly",
    });

    expect(r[0]?.delivered).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/xxx/yyy/zzz",
      expect.any(Object)
    );
  });
});
