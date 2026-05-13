import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type TrainingModuleRow = {
  id: string;
  tenant_id: string | null;
  title: string;
  category: string;
  description: string | null;
  duration_minutes: number;
  completion_rate: number;
  passing_score: number;
  status: string;
  total_enrolled: number;
  total_completed: number;
  created_at: string;
  updated_at: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildMetrics(modules: TrainingModuleRow[]) {
  const totalModules = modules.length;
  const activeModules = modules.filter((module) => module.status === "active").length;
  const totalEnrolled = modules.reduce((sum, module) => sum + (Number(module.total_enrolled) || 0), 0);
  const totalCompleted = modules.reduce((sum, module) => sum + (Number(module.total_completed) || 0), 0);
  const avgCompletionRate =
    totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;
  const categoryMap = new Map<string, { enrolled: number; completed: number }>();

  for (const module of modules) {
    const current = categoryMap.get(module.category) ?? { enrolled: 0, completed: 0 };
    current.enrolled += Number(module.total_enrolled) || 0;
    current.completed += Number(module.total_completed) || 0;
    categoryMap.set(module.category, current);
  }

  const categoryStats = Array.from(categoryMap.entries()).map(([name, stats]) => ({
    name,
    enrolled: stats.enrolled,
    completed: stats.completed,
    rate: stats.enrolled > 0 ? Math.round((stats.completed / stats.enrolled) * 100) : 0,
  }));

  return {
    totalModules,
    activeModules,
    totalEnrolled,
    totalCompleted,
    avgCompletionRate,
    categoryStats,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("training_modules")
      .select(
        "id, tenant_id, title, category, description, duration_minutes, completion_rate, passing_score, status, total_enrolled, total_completed, created_at, updated_at"
      )
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .order("status", { ascending: true })
      .order("category", { ascending: true })
      .order("title", { ascending: true });

    if (status.length > 0) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const modules = (data ?? []) as TrainingModuleRow[];

    return NextResponse.json(
      {
        ok: true,
        modules,
        metrics: buildMetrics(modules),
        count: modules.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load training modules", message },
      { status: 500 }
    );
  }
}
