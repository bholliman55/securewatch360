/**
 * Executive / simulation rollup — readable outcomes without operational noise.
 */

import { z } from "zod";

export const executiveBriefSchema = z.object({
  brief_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  /** Simulation run or curated demo scenario identifier. */
  simulation_run_id: z.string().min(1).max(256),
  generated_at: z.string().datetime(),
  /** One-page narrative for leadership — no stack traces or raw JSON. */
  executive_summary: z.string().min(1).max(6000),
  business_impact: z.string().max(4000),
  posture_delta: z.string().max(4000),
  notable_actions: z.array(z.string().max(500)).max(12),
  open_questions: z.array(z.string().max(500)).max(8),
});

export type ExecutiveBrief = z.infer<typeof executiveBriefSchema>;
