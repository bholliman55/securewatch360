/**
 * Zod schemas for outbound SOC notifications (chat, paging, email).
 */

import { z } from "zod";

export const notificationChannelSchema = z.enum([
  "slack",
  "microsoft_teams",
  "pagerduty",
  "email",
]);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notifyChannelSchema = z.object({
  tenant_id: z.string().uuid(),
  channel: notificationChannelSchema,
  /** Workspace / routing key / distribution list identifier — resolved by tenant integration config at runtime. */
  destination: z.string().min(1).max(512),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(32000),
  severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
  /** Optional deep link back to SecureWatch360. */
  dashboard_url: z.string().url().optional(),
  /** Relate notification to an external PSA ticket if already created. */
  external_ticket_id: z.string().optional(),
  correlation: z
    .object({
      simulation_run_id: z.string().min(1).optional(),
      incident_id: z.string().min(1).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type NotifyChannelInput = z.infer<typeof notifyChannelSchema>;
