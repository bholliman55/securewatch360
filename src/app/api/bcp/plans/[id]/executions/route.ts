import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getCurrentUser } from "@/lib/auth";

type StepOutcome = {
  step: string;
  completed: boolean;
  actual_hours?: number;
  skipped: boolean;
  notes?: string;
};

/**
 * GET  /api/bcp/plans/:id/executions?tenantId=…
 * Returns execution history + aggregate learning stats for a plan.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst", "viewer"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const supabase = getSupabaseAdminClient();

  const { data: executions, error } = await supabase
    .from("playbook_executions")
    .select("*")
    .eq("plan_id", planId)
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: insights } = await supabase
    .from("playbook_insights")
    .select("*")
    .eq("plan_id", planId)
    .eq("tenant_id", tenantId)
    .gt("expires_at", new Date().toISOString())
    .order("severity", { ascending: false });

  // Compute aggregate stats from executions
  const completed = (executions ?? []).filter(e => e.completed_at);
  const resolved = completed.filter(e => e.outcome === "resolved").length;
  const avgHours =
    completed.length > 0
      ? completed.reduce((sum, e) => sum + (e.actual_duration_hours ?? 0), 0) / completed.length
      : null;

  const stats = {
    timesRun: (executions ?? []).length,
    timesResolved: resolved,
    successRate: completed.length > 0 ? Math.round((resolved / completed.length) * 100) : null,
    avgDurationHours: avgHours !== null ? Math.round(avgHours * 10) / 10 : null,
  };

  return NextResponse.json({
    ok: true,
    executions: executions ?? [],
    insights: insights ?? [],
    stats,
  });
}

/**
 * POST /api/bcp/plans/:id/executions?tenantId=…
 * Records a new execution (or logs completion of an existing one).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const user = await getCurrentUser();

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const {
    incident_id, incident_title, incident_severity, incident_category,
    outcome, step_outcomes, lessons_learned, completed,
  } = body as {
    incident_id?: string;
    incident_title?: string;
    incident_severity?: string;
    incident_category?: string;
    outcome?: string;
    step_outcomes?: StepOutcome[];
    lessons_learned?: string;
    completed?: boolean;
  };

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("playbook_executions")
    .insert({
      tenant_id: tenantId,
      plan_id: planId,
      incident_id: incident_id ?? null,
      incident_title: incident_title ?? null,
      incident_severity: incident_severity ?? null,
      incident_category: incident_category ?? null,
      outcome: outcome ?? null,
      step_outcomes: step_outcomes ?? [],
      lessons_learned: lessons_learned ?? null,
      completed_at: completed ? new Date().toISOString() : null,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Regenerate insights for this plan after each new execution
  if (completed && step_outcomes && step_outcomes.length > 0) {
    await regenerateInsights(supabase, tenantId, planId);
  }

  return NextResponse.json({ ok: true, execution: data }, { status: 201 });
}

async function regenerateInsights(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  planId: string
) {
  // Fetch recent executions for analysis
  const { data: executions } = await supabase
    .from("playbook_executions")
    .select("step_outcomes, outcome, actual_duration_hours")
    .eq("plan_id", planId)
    .eq("tenant_id", tenantId)
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(10);

  if (!executions || executions.length < 2) return;

  const insights: {
    tenant_id: string;
    plan_id: string;
    insight_type: string;
    step_name?: string;
    detail: string;
    severity: string;
    times_observed: number;
  }[] = [];

  // Aggregate skip rates and SLA breaches by step name
  const stepStats: Record<string, { total: number; skipped: number; overSla: number; totalHours: number }> = {};

  for (const exec of executions) {
    const steps = (exec.step_outcomes ?? []) as StepOutcome[];
    for (const s of steps) {
      if (!stepStats[s.step]) stepStats[s.step] = { total: 0, skipped: 0, overSla: 0, totalHours: 0 };
      stepStats[s.step].total++;
      if (s.skipped) stepStats[s.step].skipped++;
      if (s.actual_hours !== undefined) stepStats[s.step].totalHours += s.actual_hours;
    }
  }

  for (const [step, stat] of Object.entries(stepStats)) {
    const skipRate = stat.total > 0 ? stat.skipped / stat.total : 0;
    if (skipRate >= 0.5 && stat.total >= 2) {
      insights.push({
        tenant_id: tenantId,
        plan_id: planId,
        insight_type: "step_often_skipped",
        step_name: step,
        detail: `"${step}" was skipped in ${Math.round(skipRate * 100)}% of executions. Consider removing or making it optional.`,
        severity: "warning",
        times_observed: stat.skipped,
      });
    }
  }

  const resolvedCount = executions.filter(e => e.outcome === "resolved").length;
  const successRate = resolvedCount / executions.length;

  if (successRate >= 0.8 && executions.length >= 3) {
    insights.push({
      tenant_id: tenantId,
      plan_id: planId,
      insight_type: "plan_effective",
      detail: `This plan has a ${Math.round(successRate * 100)}% resolution rate across ${executions.length} recent incidents. It is performing well.`,
      severity: "info",
      times_observed: resolvedCount,
    });
  } else if (successRate < 0.5 && executions.length >= 3) {
    insights.push({
      tenant_id: tenantId,
      plan_id: planId,
      insight_type: "plan_needs_review",
      detail: `Only ${Math.round(successRate * 100)}% of incidents were resolved using this plan. Review the procedures and consider adding missing steps.`,
      severity: "critical",
      times_observed: executions.length - resolvedCount,
    });
  }

  if (insights.length > 0) {
    // Clear stale insights and insert new ones
    await supabase
      .from("playbook_insights")
      .delete()
      .eq("plan_id", planId)
      .eq("tenant_id", tenantId);

    await supabase.from("playbook_insights").insert(insights);
  }
}
