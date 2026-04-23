import { getSupabaseAdminClient } from "@/lib/supabase";

export const LEARNING_SOURCES = [
  "in_app",
  "support",
  "qbr",
  "onboarding",
  "pilot",
  "integration",
  "api",
  "other",
] as const;

export const LEARNING_INTERACTION_KINDS = [
  "feedback",
  "friction",
  "feature_request",
  "blocker",
  "workaround",
  "confusion",
  "praise",
  "other",
] as const;

export type LearningSource = (typeof LEARNING_SOURCES)[number];
export type LearningInteractionKind = (typeof LEARNING_INTERACTION_KINDS)[number];

export type ClientLearningInput = {
  tenantId: string;
  source: LearningSource;
  interactionKind: LearningInteractionKind;
  title: string;
  body?: string;
  structuredSignals?: Record<string, unknown>;
  impact: "low" | "medium" | "high";
  productArea?: string | null;
  targetRelease?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdBy?: string | null;
};

/**
 * Best-effort insert for the client learning store. Does not throw (mirrors audit pattern).
 */
export async function recordClientLearning(input: ClientLearningInput): Promise<{ id: string } | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("client_interaction_learnings")
      .insert({
        tenant_id: input.tenantId,
        source: input.source,
        interaction_kind: input.interactionKind,
        title: input.title,
        body: input.body ?? "",
        structured_signals: input.structuredSignals ?? {},
        impact: input.impact,
        product_area: input.productArea ?? null,
        target_release: input.targetRelease ?? null,
        related_entity_type: input.relatedEntityType ?? null,
        related_entity_id: input.relatedEntityId ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[clientLearning] insert failed", { message: error?.message, tenantId: input.tenantId });
      return null;
    }
    return { id: data.id as string };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("[clientLearning] unexpected insert failure", { tenantId: input.tenantId, message });
    return null;
  }
}
