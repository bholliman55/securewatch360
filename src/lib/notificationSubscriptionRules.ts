/**
 * Valid values for `notification_subscription_rules` (MVP notification hub).
 * Keep in sync with `supabase/migrations/*notification_subscription_rules*.sql`.
 */
export const NOTIFICATION_CHANNELS = ["email", "slack", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DIGEST_INTERVALS = ["off", "hourly", "daily", "weekly"] as const;
export type NotificationDigestInterval = (typeof NOTIFICATION_DIGEST_INTERVALS)[number];

export const NOTIFICATION_MIN_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type NotificationMinSeverity = (typeof NOTIFICATION_MIN_SEVERITIES)[number];

export type NotificationSubscriptionRuleRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  label: string;
  min_severity: NotificationMinSeverity;
  channel: NotificationChannel;
  digest_interval: NotificationDigestInterval;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export function isAdminLikeRole(
  role: "owner" | "admin" | "analyst" | "viewer"
): role is "owner" | "admin" {
  return role === "owner" || role === "admin";
}
