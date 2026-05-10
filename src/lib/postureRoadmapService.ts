/**
 * Posture Roadmap service layer.
 *
 * Computes current cybersecurity/compliance posture, generates target state,
 * builds gap analysis, and manages roadmap items — all scoped to a tenant.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FrameworkReadiness,
  GapItem,
  PostureCurrentState,
  PostureRoadmapItem,
  PostureRoadmapSummary,
  PostureTargetState,
  RoadmapCategory,
  RequiredControl,
  TopRisk,
} from "@/types/posture-roadmap";
import { ROADMAP_CATEGORY_LABELS } from "@/types/posture-roadmap";

// ────────────────────────────────────────────────────────────────────────────
// Framework metadata constants
// ────────────────────────────────────────────────────────────────────────────

const FRAMEWORK_DISPLAY_NAMES: Record<string, string> = {
  CIS: "CIS Controls v8",
  NIST: "NIST CSF 2.0",
  CMMC_L1: "CMMC Level 1",
  CMMC_L2: "CMMC Level 2",
  HIPAA: "HIPAA Security Rule",
  SOC2: "SOC 2",
  CMMC: "CMMC",
  ISO27001: "ISO 27001",
  PCI_DSS: "PCI-DSS",
};

/** Required maturity score (0–100) to be "ready" for a given framework. */
const FRAMEWORK_REQUIRED_MATURITY: Record<string, number> = {
  CIS: 70,
  NIST: 65,
  CMMC_L1: 60,
  CMMC_L2: 80,
  HIPAA: 75,
  SOC2: 72,
  CMMC: 70,
  ISO27001: 72,
  PCI_DSS: 75,
};

/** The frameworks shown in the Current State panel. */
const DASHBOARD_FRAMEWORKS = ["CIS", "NIST", "CMMC_L1", "CMMC_L2", "HIPAA", "SOC2"];

/** Maps a DB framework_code to the query key used above. */
function normalizeFrameworkCode(code: string): string {
  const upper = code.toUpperCase();
  if (upper === "SOC2") return "SOC2";
  if (upper === "NIST") return "NIST";
  if (upper === "HIPAA") return "HIPAA";
  if (upper === "CMMC") return "CMMC";
  if (upper === "CIS") return "CIS";
  if (upper === "ISO27001") return "ISO27001";
  if (upper === "PCI_DSS") return "PCI_DSS";
  return upper;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function maturityLabel(score: number): string {
  if (score >= 85) return "Advanced";
  if (score >= 70) return "Managed";
  if (score >= 50) return "Developing";
  if (score >= 30) return "Initiating";
  return "Ad Hoc";
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

// ────────────────────────────────────────────────────────────────────────────
// Current state computation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Computes a live current posture snapshot for the tenant.
 * Pulls data from control_frameworks, control_requirements, finding_control_mappings,
 * findings, and scan_targets.
 */
export async function computeCurrentState(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PostureCurrentState> {
  // ── 1. Framework readiness via control pass/fail ──────────────────────────
  const { data: frameworks } = await supabase
    .from("control_frameworks")
    .select("id, framework_code, framework_name");

  const { data: controls } = await supabase
    .from("control_requirements")
    .select("id, framework_id, control_code, title");

  const { data: mappings } = await supabase
    .from("finding_control_mappings")
    .select("control_requirement_id, finding_id, finding:findings(status)")
    .eq("tenant_id", tenantId);

  const openByControl = new Map<string, number>();
  for (const m of mappings ?? []) {
    const finding = m.finding as { status: string } | { status: string }[] | null;
    const status = Array.isArray(finding) ? finding[0]?.status : finding?.status;
    if (status && status !== "resolved" && status !== "risk_accepted") {
      openByControl.set(m.control_requirement_id, (openByControl.get(m.control_requirement_id) ?? 0) + 1);
    }
  }

  const frameworkReadiness: FrameworkReadiness[] = [];
  let totalPass = 0;
  let totalControls = 0;

  for (const fwKey of DASHBOARD_FRAMEWORKS) {
    // CMMC_L1 and CMMC_L2 both map to the CMMC framework_code in the DB
    const dbCode = fwKey === "CMMC_L1" || fwKey === "CMMC_L2" ? "CMMC" : fwKey;
    const fw = (frameworks ?? []).find(
      (f) => f.framework_code?.toUpperCase() === dbCode.toUpperCase()
    );

    const fwControls = fw
      ? (controls ?? []).filter((c) => c.framework_id === fw.id)
      : [];

    let pass = 0;
    let fail = 0;
    for (const ctrl of fwControls) {
      if ((openByControl.get(ctrl.id) ?? 0) > 0) {
        fail++;
      } else {
        pass++;
      }
    }

    // Apply a tier modifier for CMMC L1 vs L2 (L1 is the first 17 controls)
    let fwPass = pass;
    let fwTotal = fwControls.length;
    if (fwKey === "CMMC_L1" && fwTotal > 17) {
      const ratio = pass / Math.max(fwTotal, 1);
      fwPass = Math.round(ratio * 17);
      fwTotal = 17;
    }

    totalPass += fwPass;
    totalControls += fwTotal;

    const pct = fwTotal > 0 ? clamp(Math.round((fwPass / fwTotal) * 100)) : 0;
    const required = FRAMEWORK_REQUIRED_MATURITY[fwKey] ?? 70;
    frameworkReadiness.push({
      framework: fwKey,
      displayName: FRAMEWORK_DISPLAY_NAMES[fwKey] ?? fwKey,
      readinessPercent: pct,
      controlsPass: fwPass,
      controlsTotal: fwTotal,
      requiredMaturityScore: required,
      gapToRequired: clamp(required - pct),
    });
  }

  // ── 2. Overall maturity score ─────────────────────────────────────────────
  const rawScore = totalControls > 0
    ? Math.round((totalPass / totalControls) * 100)
    : 0;

  // ── 3. Findings metrics ───────────────────────────────────────────────────
  const { data: findingsData } = await supabase
    .from("findings")
    .select("id, title, severity, category, status, asset_type, priority_score")
    .eq("tenant_id", tenantId)
    .neq("status", "resolved")
    .neq("status", "risk_accepted")
    .order("priority_score", { ascending: false })
    .limit(200);

  const openFindings = findingsData ?? [];
  const criticalCount = openFindings.filter((f) => f.severity === "critical").length;
  const highCount = openFindings.filter((f) => f.severity === "high").length;
  const identityGaps = openFindings.filter((f) =>
    ["auth", "identity", "access", "credential", "permission"].some((kw) =>
      (f.category ?? "").toLowerCase().includes(kw)
    )
  ).length;

  const topRisks: TopRisk[] = openFindings.slice(0, 8).map((f) => ({
    findingId: f.id,
    title: f.title,
    severity: f.severity,
    category: f.category,
    priorityScore: f.priority_score ?? 0,
    status: f.status,
    assetType: f.asset_type,
  }));

  // ── 4. Missing controls (controls with no mapped findings at all) ─────────
  const mappedControlIds = new Set((mappings ?? []).map((m) => m.control_requirement_id));
  const missingControlsCount = (controls ?? []).filter(
    (c) => !mappedControlIds.has(c.id)
  ).length;

  // ── 5. Exposed assets ─────────────────────────────────────────────────────
  const { count: exposedCount } = await supabase
    .from("scan_targets")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("exposure", ["internet", "external"]);

  // ── 6. Severity deduction on maturity score ───────────────────────────────
  const severityDeduction = Math.min(20, criticalCount * 3 + highCount);
  const maturityScore = clamp(rawScore - severityDeduction);

  return {
    maturityScore,
    maturityLabel: maturityLabel(maturityScore),
    frameworkReadiness,
    topRisks,
    missingControlsCount,
    exposedAssetsCount: exposedCount ?? 0,
    unresolvedFindingsCount: openFindings.length,
    criticalFindingsCount: criticalCount,
    highFindingsCount: highCount,
    identityGapsCount: identityGaps,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Target state
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the target state for the given framework, comparing the tenant's
 * current posture against what's required.
 */
export async function computeTargetState(
  supabase: SupabaseClient,
  tenantId: string,
  targetFramework: string,
  currentMaturityScore: number
): Promise<PostureTargetState> {
  const dbCode = targetFramework === "CMMC_L1" || targetFramework === "CMMC_L2"
    ? "CMMC"
    : targetFramework;

  const { data: fw } = await supabase
    .from("control_frameworks")
    .select("id")
    .eq("framework_code", dbCode.toUpperCase())
    .single();

  let keyRequiredControls: RequiredControl[] = [];
  let requiredControlCount = 0;
  let metControlCount = 0;

  if (fw) {
    const { data: controls } = await supabase
      .from("control_requirements")
      .select("id, control_code, title")
      .eq("framework_id", fw.id)
      .order("control_code", { ascending: true })
      .limit(targetFramework === "CMMC_L1" ? 17 : 200);

    const { data: mappings } = await supabase
      .from("finding_control_mappings")
      .select("control_requirement_id, finding:findings(status)")
      .eq("tenant_id", tenantId);

    const openByControl = new Map<string, number>();
    for (const m of mappings ?? []) {
      const finding = m.finding as { status: string } | { status: string }[] | null;
      const status = Array.isArray(finding) ? finding[0]?.status : finding?.status;
      if (status && status !== "resolved" && status !== "risk_accepted") {
        openByControl.set(
          m.control_requirement_id,
          (openByControl.get(m.control_requirement_id) ?? 0) + 1
        );
      }
    }

    const allControls = controls ?? [];
    requiredControlCount = allControls.length;
    metControlCount = allControls.filter((c) => (openByControl.get(c.id) ?? 0) === 0).length;
    const currentGapControls = allControls.filter((c) => (openByControl.get(c.id) ?? 0) > 0);

    keyRequiredControls = allControls.slice(0, 12).map((c) => ({
      controlCode: c.control_code,
      controlTitle: c.title,
      status: (openByControl.get(c.id) ?? 0) > 0 ? "gap" : "met",
    }));

    // Ensure gap controls surface at the top
    const gapSet = new Set(currentGapControls.map((c) => c.id));
    keyRequiredControls.sort((a, b) => {
      const aGap = gapSet.has(
        allControls.find((c) => c.control_code === a.controlCode)?.id ?? ""
      );
      const bGap = gapSet.has(
        allControls.find((c) => c.control_code === b.controlCode)?.id ?? ""
      );
      return Number(bGap) - Number(aGap);
    });
  }

  const requiredMaturityScore = FRAMEWORK_REQUIRED_MATURITY[targetFramework] ?? 70;
  const distance = clamp(requiredMaturityScore - currentMaturityScore);
  const gapCount = requiredControlCount - metControlCount;

  return {
    targetFramework,
    targetFrameworkDisplayName: FRAMEWORK_DISPLAY_NAMES[targetFramework] ?? targetFramework,
    requiredMaturityScore,
    currentMaturityScore,
    distanceToReadiness: distance,
    currentGapCount: gapCount,
    requiredControlCount,
    metControlCount,
    keyRequiredControls: keyRequiredControls.slice(0, 10),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Gap analysis
// ────────────────────────────────────────────────────────────────────────────

/** Groups roadmap items by category to produce the gap analysis view. */
export function buildGapAnalysis(items: PostureRoadmapItem[]): GapItem[] {
  const byCategory = new Map<RoadmapCategory, PostureRoadmapItem[]>();

  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  return Array.from(byCategory.entries()).map(([category, categoryItems]) => ({
    category,
    categoryLabel: ROADMAP_CATEGORY_LABELS[category],
    gapCount: categoryItems.length,
    criticalCount: categoryItems.filter((i) => i.priority === "critical").length,
    highCount: categoryItems.filter((i) => i.priority === "high").length,
    items: categoryItems.sort(
      (a, b) =>
        ["critical", "high", "medium", "low"].indexOf(a.priority) -
        ["critical", "high", "medium", "low"].indexOf(b.priority)
    ),
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Roadmap items CRUD
// ────────────────────────────────────────────────────────────────────────────

export async function getRoadmapItems(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PostureRoadmapItem[]> {
  const { data, error } = await supabase
    .from("posture_roadmap_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PostureRoadmapItem[];
}

export async function updateRoadmapItemStatus(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  status: string
): Promise<PostureRoadmapItem> {
  const { data, error } = await supabase
    .from("posture_roadmap_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PostureRoadmapItem;
}

export async function getOrSetTargetFramework(
  supabase: SupabaseClient,
  tenantId: string,
  override?: string
): Promise<string> {
  if (override) {
    await supabase.from("posture_target_config").upsert(
      { tenant_id: tenantId, target_framework: override, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
    return override;
  }

  const { data } = await supabase
    .from("posture_target_config")
    .select("target_framework")
    .eq("tenant_id", tenantId)
    .single();

  return data?.target_framework ?? "CMMC_L2";
}

// ────────────────────────────────────────────────────────────────────────────
// Full summary (used by the main page load)
// ────────────────────────────────────────────────────────────────────────────

export async function getPostureRoadmapSummary(
  supabase: SupabaseClient,
  tenantId: string,
  targetFrameworkOverride?: string
): Promise<PostureRoadmapSummary> {
  const targetFramework = await getOrSetTargetFramework(supabase, tenantId, targetFrameworkOverride);

  const [currentState, items] = await Promise.all([
    computeCurrentState(supabase, tenantId),
    getRoadmapItems(supabase, tenantId),
  ]);

  const targetState = await computeTargetState(
    supabase,
    tenantId,
    targetFramework,
    currentState.maturityScore
  );

  const gaps = buildGapAnalysis(items);

  return {
    currentState,
    targetState,
    gaps,
    totalRoadmapItems: items.length,
    criticalItems: items.filter((i) => i.priority === "critical").length,
    highItems: items.filter((i) => i.priority === "high").length,
    completedItems: items.filter((i) => i.status === "completed").length,
    inProgressItems: items.filter((i) => i.status === "in_progress").length,
    automationAvailableCount: items.filter((i) => i.automation_level === "now").length,
  };
}
