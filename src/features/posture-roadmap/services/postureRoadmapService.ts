/**
 * SecureWatch360 — Posture Roadmap feature-layer service.
 *
 * Orchestrates the full assessment lifecycle:
 *   adapter → scoring engine → DB write → read/update
 *
 * All public functions are server-side only (admin client).
 * RLS on the posture tables is enforced at the DB level; the admin client
 * bypasses it, so callers must enforce tenant access upstream (requireTenantAccess).
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { generatePostureAssessment } from "@/features/posture-roadmap/services/postureScoringService";
import { buildPostureScoringInput } from "@/features/posture-roadmap/services/postureDataAdapter";
import { PostureRoadmapError } from "@/features/posture-roadmap/services/postureDataAdapter";
import { validateFramework } from "@/features/posture-roadmap/services/postureDataAdapter";
import { FRAMEWORK_TYPES } from "@/features/posture-roadmap/types/postureTypes";
import type {
  PostureAssessment,
  FrameworkReadinessScore,
  PostureGap,
  PostureRoadmapActionItem,
  PostureScoreHistory,
  GapSeverity,
  AutomationStatus,
  RoadmapBucket,
} from "@/features/posture-roadmap/types/postureTypes";
import type { PostureAssessmentResult } from "@/features/posture-roadmap/types/postureTypes";

export { PostureRoadmapError } from "@/features/posture-roadmap/services/postureDataAdapter";
export type { PostureRoadmapErrorCode } from "@/features/posture-roadmap/services/postureDataAdapter";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps scoring engine automationLevel values to the DB check constraint values. */
function toAutomationStatus(level: "now" | "later" | "not_yet"): AutomationStatus {
  if (level === "now") return "available_now";
  if (level === "later") return "planned";
  return "manual_only";
}

/** Maps priority to the roadmap bucket for 90-day planning. */
function toRoadmapBucket(priority: string): RoadmapBucket {
  if (priority === "critical") return "fix_first";
  if (priority === "high") return "next_30_days";
  if (priority === "medium") return "next_60_days";
  return "next_90_days";
}

function supabaseError(message: string, cause?: unknown): PostureRoadmapError {
  return new PostureRoadmapError(message, "SUPABASE_ERROR", cause);
}

// ─────────────────────────────────────────────────────────────────────────────
// Read: assessments
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the most recent persisted assessment for the tenant, or null. */
export async function getLatestPostureAssessment(
  tenantId: string,
  clientId?: string
): Promise<PostureAssessment | null> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("posture_assessments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw supabaseError(`Failed to fetch assessment: ${error.message}`, error);
  return data as PostureAssessment | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read: sub-tables
// ─────────────────────────────────────────────────────────────────────────────

export async function getFrameworkReadinessScores(
  assessmentId: string
): Promise<FrameworkReadinessScore[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("framework_readiness_scores")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("framework", { ascending: true });

  if (error) throw supabaseError(`Failed to fetch framework readiness: ${error.message}`, error);
  return (data ?? []) as FrameworkReadinessScore[];
}

export interface PostureGapFilters {
  severity?: GapSeverity;
  framework?: string;
  category?: string;
}

export async function getPostureGaps(
  assessmentId: string,
  filters?: PostureGapFilters
): Promise<PostureGap[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("posture_gaps")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("severity", { ascending: true }); // critical < high < low alphabetically; real order via client sort

  if (filters?.severity) query = query.eq("severity", filters.severity);
  if (filters?.framework) query = query.eq("framework", filters.framework);
  if (filters?.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw supabaseError(`Failed to fetch posture gaps: ${error.message}`, error);
  return (data ?? []) as PostureGap[];
}

export interface RoadmapItemFilters {
  status?: PostureRoadmapActionItem["status"];
  priority?: GapSeverity;
  roadmap_bucket?: RoadmapBucket;
}

export async function getRoadmapItems(
  assessmentId: string,
  filters?: RoadmapItemFilters
): Promise<PostureRoadmapActionItem[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("posture_roadmap_action_items")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("sort_order", { ascending: true });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.priority) query = query.eq("priority", filters.priority);
  if (filters?.roadmap_bucket) query = query.eq("roadmap_bucket", filters.roadmap_bucket);

  const { data, error } = await query;
  if (error) throw supabaseError(`Failed to fetch roadmap items: ${error.message}`, error);
  return (data ?? []) as PostureRoadmapActionItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Write: status update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateRoadmapItemStatus(
  itemId: string,
  status: PostureRoadmapActionItem["status"]
): Promise<PostureRoadmapActionItem> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("posture_roadmap_action_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .select()
    .maybeSingle();

  if (error) throw supabaseError(`Failed to update roadmap item: ${error.message}`, error);
  if (!data) {
    throw new PostureRoadmapError(`Roadmap item ${itemId} not found`, "ASSESSMENT_NOT_FOUND");
  }
  return data as PostureRoadmapActionItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write: persist a complete assessment result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persists a scoring result to all five posture tables in a single logical
 * batch. Uses sequential inserts (no transactions in Supabase JS) so the
 * assessment row is always written first; partial failures leave orphaned
 * child rows but never a corrupt assessment row.
 */
export async function createPostureAssessment(
  result: PostureAssessmentResult,
  tenantId: string,
  clientId?: string,
  assessmentName?: string
): Promise<PostureAssessment> {
  const supabase = getSupabaseAdminClient();

  // 1. posture_assessments ───────────────────────────────────────────────────
  const { data: assessment, error: assessmentErr } = await supabase
    .from("posture_assessments")
    .insert({
      tenant_id: tenantId,
      client_id: clientId ?? null,
      assessment_name: assessmentName ?? `Assessment ${new Date().toISOString()}`,
      overall_score: result.overallScore,
      maturity_level: result.maturityLabel,
      target_framework: result.targetFramework,
      target_score: result.targetScore,
      readiness_percentage: result.readinessPercentage,
      summary: result.summary,
      is_estimated: result.isEstimated,
    })
    .select()
    .single();

  if (assessmentErr || !assessment) {
    throw supabaseError(
      `Failed to create posture assessment: ${assessmentErr?.message ?? "no data returned"}`,
      assessmentErr
    );
  }

  const assessmentId: string = (assessment as PostureAssessment).id;

  // 2. framework_readiness_scores ────────────────────────────────────────────
  if (result.frameworkReadiness.length > 0) {
    const fwRows = result.frameworkReadiness.map((fr) => ({
      assessment_id: assessmentId,
      framework: fr.framework,
      readiness_percentage: fr.readinessPercent,
      current_score: fr.currentScore,
      target_score: fr.targetScore,
      status: fr.status,
      top_gap: null as string | null,
    }));

    const { error: fwErr } = await supabase
      .from("framework_readiness_scores")
      .insert(fwRows);

    if (fwErr) {
      throw supabaseError(
        `Assessment created but framework readiness insert failed: ${fwErr.message}`,
        fwErr
      );
    }
  }

  // 3. posture_gaps ──────────────────────────────────────────────────────────
  if (result.gaps.length > 0) {
    const gapRows = result.gaps.map((g) => ({
      assessment_id: assessmentId,
      category: g.category,
      framework: g.framework,
      control_id: g.controlId ?? null,
      control_name: g.controlName ?? null,
      current_state: g.currentState,
      desired_state: g.desiredState,
      gap_description: g.gapDescription,
      severity: g.severity as GapSeverity,
      evidence_source: null as string | null,
      related_asset_id: null as string | null,
      related_finding_id: null as string | null,
      is_estimated: g.isEstimated,
    }));

    const { error: gapErr } = await supabase.from("posture_gaps").insert(gapRows);
    if (gapErr) {
      throw supabaseError(
        `Assessment created but gap insert failed: ${gapErr.message}`,
        gapErr
      );
    }
  }

  // 4. posture_roadmap_action_items ──────────────────────────────────────────
  if (result.roadmapItems.length > 0) {
    const itemRows = result.roadmapItems.map((item, idx) => ({
      assessment_id: assessmentId,
      title: item.title,
      category: item.category,
      framework: item.relatedFramework,
      priority: item.priority,
      estimated_effort: item.estimatedEffort,
      estimated_impact_score: item.estimatedImpactScore,
      current_state: item.currentState,
      desired_state: item.desiredState,
      recommended_action: item.recommendedAction,
      automation_status: toAutomationStatus(item.automationLevel),
      securewatch_agent: null as string | null,
      status: "not_started" as const,
      roadmap_bucket: toRoadmapBucket(item.priority),
      sort_order: idx,
    }));

    const { error: itemErr } = await supabase
      .from("posture_roadmap_action_items")
      .insert(itemRows);

    if (itemErr) {
      throw supabaseError(
        `Assessment created but roadmap item insert failed: ${itemErr.message}`,
        itemErr
      );
    }
  }

  // 5. posture_score_history ─────────────────────────────────────────────────
  const frameworkScores = Object.fromEntries(
    result.frameworkReadiness.map((fr) => [fr.framework, fr.readinessPercent])
  );

  const { error: histErr } = await supabase.from("posture_score_history").insert({
    tenant_id: tenantId,
    client_id: clientId ?? null,
    assessment_id: assessmentId,
    overall_score: result.overallScore,
    cis_v8_score: frameworkScores["CIS"] ?? null,
    nist_csf_score: frameworkScores["NIST"] ?? null,
    cmmc_l1_score: frameworkScores["CMMC_L1"] ?? null,
    cmmc_l2_score: frameworkScores["CMMC_L2"] ?? null,
    hipaa_score: frameworkScores["HIPAA"] ?? null,
    soc2_score: frameworkScores["SOC2"] ?? null,
  });

  if (histErr) {
    // Non-fatal: assessment is usable even if history row fails
    console.warn("[postureRoadmapService] Score history insert failed:", histErr.message);
  }

  return assessment as PostureAssessment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator: generate + persist
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full pipeline: fetch live data → score → persist → return.
 *
 * Validates tenantId and targetFramework before doing any work.
 * Throws PostureRoadmapError for known failure modes; unexpected errors bubble.
 */
export async function generateNewPostureAssessment(
  tenantId: string,
  targetFramework: string,
  clientId?: string,
  assessmentName?: string
): Promise<{ assessment: PostureAssessment; result: PostureAssessmentResult }> {
  validateFramework(targetFramework);

  const input = await buildPostureScoringInput(tenantId, clientId);

  if (
    input.openFindings.length === 0 &&
    input.totalAssets === 0 &&
    input.totalUsers === 0 &&
    input.controlsMapped === 0
  ) {
    throw new PostureRoadmapError(
      `No scan data found for tenant ${tenantId}. Run a scan before generating a posture assessment.`,
      "NO_SCAN_DATA"
    );
  }

  const result = generatePostureAssessment(input, targetFramework, {
    clientId,
    assessmentName,
  });

  const assessment = await createPostureAssessment(result, tenantId, clientId, assessmentName);

  return { assessment, result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Automation plan preview
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationPlanPreview {
  itemId: string;
  title: string;
  automationStatus: AutomationStatus | null;
  securewatch_agent: string | null;
  recommendedAction: string | null;
  canAutomate: boolean;
  automationSummary: string;
  nextSteps: string[];
}

/**
 * Returns a deterministic automation plan preview for a single roadmap item.
 * Does not trigger any execution.
 */
export async function previewAutomationPlan(
  roadmapItemId: string
): Promise<AutomationPlanPreview> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("posture_roadmap_action_items")
    .select(
      "id, title, automation_status, securewatch_agent, recommended_action, category, priority"
    )
    .eq("id", roadmapItemId)
    .maybeSingle();

  if (error) throw supabaseError(`Failed to fetch roadmap item: ${error.message}`, error);
  if (!data) {
    throw new PostureRoadmapError(
      `Roadmap item ${roadmapItemId} not found`,
      "ASSESSMENT_NOT_FOUND"
    );
  }

  const item = data as {
    id: string;
    title: string;
    automation_status: AutomationStatus | null;
    securewatch_agent: string | null;
    recommended_action: string | null;
    category: string;
    priority: string;
  };

  const canAutomate = item.automation_status === "available_now";

  let automationSummary: string;
  let nextSteps: string[];

  if (item.automation_status === "available_now") {
    automationSummary =
      "This item can be automated immediately via a SecureWatch360 agent or integration.";
    nextSteps = [
      "Review the recommended action below.",
      "Confirm the target scope with your team.",
      "Trigger automation from the Remediation console or via the /api/posture-roadmap/automate endpoint.",
    ];
  } else if (item.automation_status === "planned") {
    automationSummary =
      "Automation support for this item is planned. Manual action is required in the interim.";
    nextSteps = [
      "Assign this item to an owner using the roadmap tracker.",
      "Follow the recommended action manually.",
      "Mark as completed once done so the posture score updates on the next assessment.",
    ];
  } else {
    automationSummary =
      "This item requires manual process or policy changes; no automated remediation is available.";
    nextSteps = [
      "Review the recommended action below.",
      "Assign to a responsible team member.",
      "Document completion evidence in the Evidence Library.",
    ];
  }

  return {
    itemId: item.id,
    title: item.title,
    automationStatus: item.automation_status,
    securewatch_agent: item.securewatch_agent,
    recommendedAction: item.recommended_action,
    canAutomate,
    automationSummary,
    nextSteps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export types needed by callers
// ─────────────────────────────────────────────────────────────────────────────

export type {
  PostureAssessment,
  FrameworkReadinessScore,
  PostureGap,
  PostureRoadmapActionItem,
  PostureScoreHistory,
  PostureAssessmentResult,
};

export { FRAMEWORK_TYPES };
