/**
 * Primary analyst dashboard brief — calm, prioritized, decision-ready (no raw log dumps).
 */

import { z } from "zod";

export const operatorBriefSectionSchema = z.object({
  headline: z.string().min(1).max(500),
  detail: z.string().max(8000),
});

export type OperatorBriefSection = z.infer<typeof operatorBriefSectionSchema>;

export const operatorBriefSchema = z.object({
  brief_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1).max(256),
  updated_at: z.string().datetime(),
  /** Single plain-English overview — suitable for the hero strip. */
  plain_english_summary: z.string().min(1).max(4000),
  what_happened: operatorBriefSectionSchema,
  why_it_matters: operatorBriefSectionSchema,
  what_securewatch360_did: operatorBriefSectionSchema,
  what_needs_approval: operatorBriefSectionSchema,
  what_failed: operatorBriefSectionSchema,
  what_risk_remains: operatorBriefSectionSchema,
  what_happens_next: operatorBriefSectionSchema,
  /** Optional structured hints for UI chips — not raw telemetry. */
  priority_hint: z.enum(["p4", "p3", "p2", "p1", "p0"]).optional(),
});

export type OperatorBrief = z.infer<typeof operatorBriefSchema>;
