/**
 * Governed AI decision shapes — recommendations only; execution stays in `actionExecutor`.
 */

import { z } from "zod";
import { ACTION_TYPES, actionTypeRequiresApproval, type ActionType } from "../actions/action.schema";

export const AI_TASK_KIND = [
  "policy_explain",
  "finding_summary",
  "threat_narrative",
  "action_recommendation",
  "compliance_draft",
] as const;

export type AiTaskKind = (typeof AI_TASK_KIND)[number];

/** AI must never claim an execution plane other than advisory / recommend-only. */
export const AI_EXECUTION_PLANE = ["recommendation_only", "analysis_only"] as const;
export type AiExecutionPlane = (typeof AI_EXECUTION_PLANE)[number];

export const aiModelRoutingSchema = z.object({
  primary_model: z.string().min(1).max(128),
  fallback_model: z.string().min(1).max(128).optional(),
  deterministic: z.boolean(),
});

export type AiModelRouting = z.infer<typeof aiModelRoutingSchema>;

export const aiActionRecommendationSchema = z
  .object({
    suggested_action_type: z.enum(ACTION_TYPES),
    rationale: z.string().min(1).max(16000),
    /** Must always be false — enforced by schema and runtime guards. */
    execute_immediately: z.literal(false),
    /** AI may only emit recommendations; `actionExecutor` enforces dry-run, approvals, and live execution. */
    execution_plane: z.literal("recommendation_only"),
    /** Set true when `actionTypeRequiresApproval` applies; AI layer must surface this to workflow UI. */
    requires_human_approval: z.boolean(),
    /** Opaque finding / incident correlation for actionExecutor payloads (filled by orchestrator, not model). */
    correlation_hints: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    const needsApproval = actionTypeRequiresApproval(val.suggested_action_type as ActionType);
    if (needsApproval && !val.requires_human_approval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `High-risk action type ${val.suggested_action_type} requires requires_human_approval=true.`,
      });
    }
  });

export type AiActionRecommendation = z.infer<typeof aiActionRecommendationSchema>;

export const aiAnalysisOnlyOutputSchema = z.object({
  execution_plane: z.literal("analysis_only"),
  summary: z.string().min(1).max(32000),
  citations: z.array(z.string().min(1)).min(1).max(64),
});

export type AiAnalysisOnlyOutput = z.infer<typeof aiAnalysisOnlyOutputSchema>;

export const aiGovernedDecisionEnvelopeSchema = z.object({
  decision_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  task_kind: z.enum(AI_TASK_KIND),
  confidence_0_1: z.number().min(0).max(1),
  routing: aiModelRoutingSchema,
  /** Model that produced the final validated payload (may equal fallback after routing). */
  effective_model: z.string().min(1).max(128),
  schema_validation_ok: z.boolean(),
  hallucination_flags: z.array(z.string()).default([]),
  estimated_cost_usd: z.number().min(0).optional(),
  /** Validated task payload — discriminated outside this envelope in validators. */
  payload_kind: z.enum(["action_recommendation", "analysis_only"]),
});

export type AiGovernedDecisionEnvelope = z.infer<typeof aiGovernedDecisionEnvelopeSchema>;

export function assertRecommendationNeverExecutes(payload: unknown): void {
  if (typeof payload === "object" && payload !== null && "execute_immediately" in payload) {
    const v = (payload as { execute_immediately?: unknown }).execute_immediately;
    if (v !== false) {
      throw new Error("ai_governance:execute_immediately_must_be_false");
    }
  }
}

export { actionTypeRequiresApproval };
