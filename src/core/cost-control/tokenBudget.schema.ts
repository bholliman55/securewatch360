/**
 * Token and estimated-spend budgets for AI workloads — tenant, incident, agent, and simulation scoped.
 */

import { z } from "zod";

export const COST_TRACKING_SCOPE = ["tenant", "incident", "agent", "simulation"] as const;
export type CostTrackingScope = (typeof COST_TRACKING_SCOPE)[number];

export const taskComplexitySchema = z.enum(["simple", "medium", "complex"]);
export type TaskComplexity = z.infer<typeof taskComplexitySchema>;

/** Default hourly / per-entity ceilings — tune per environment. */
export const tokenBudgetPolicySchema = z.object({
  tenant_max_tokens_per_hour: z.number().int().positive(),
  tenant_max_usd_per_hour: z.number().positive(),
  incident_max_tokens_total: z.number().int().positive(),
  incident_max_usd_total: z.number().positive(),
  agent_max_tokens_per_hour: z.number().int().positive(),
  agent_max_usd_per_hour: z.number().positive(),
  simulation_max_tokens_total: z.number().int().positive(),
  simulation_max_usd_total: z.number().positive(),
  /** Fraction 0–1 of any cap that triggers a soft alert (does not block). */
  warn_threshold_fraction: z.number().min(0.05).max(0.99).default(0.85),
  /** Estimated USD above which high-tier model use requires explicit approval in workflows. */
  high_cost_model_usd_approval_threshold: z.number().positive().default(0.25),
});

export type TokenBudgetPolicy = z.infer<typeof tokenBudgetPolicySchema>;

export const spendRecordSchema = z.object({
  tenant_id: z.string().uuid(),
  incident_id: z.string().min(1).max(256).optional(),
  agent_id: z.string().min(1).max(256).optional(),
  simulation_run_id: z.string().min(1).max(256).optional(),
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  estimated_usd: z.number().nonnegative(),
  recorded_at_ms: z.number().int().nonnegative(),
  model_id: z.string().max(128).optional(),
});

export type SpendRecord = z.infer<typeof spendRecordSchema>;

export const budgetAlertSchema = z.object({
  scope: z.enum(["tenant", "incident", "agent", "simulation"]),
  level: z.enum(["warn", "block"]),
  message: z.string(),
  at_ms: z.number().int(),
  tenant_id: z.string().uuid(),
});

export type BudgetAlert = z.infer<typeof budgetAlertSchema>;
