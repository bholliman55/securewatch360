import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

const VALID_STATUSES = ["pass", "fail", "partial", "unknown", "evidence_missing"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const framework = searchParams.get("framework")?.trim() ?? "";
    const scanRunId = searchParams.get("scanRunId")?.trim() ?? "";

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.read],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("compliance_scan_results")
      .select(
        "id, scan_run_id, framework, control_id, control_name, status, evidence, gap, recommended_action, severity, related_asset_id, related_finding_id, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (framework) {
      query = query.eq("framework", framework);
    }
    if (scanRunId) {
      query = query.eq("scan_run_id", scanRunId);
    }

    const { data, error } = await query.limit(500);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const results = data ?? [];

    // Compute summary
    const statusCounts: Record<string, number> = {};
    for (const s of VALID_STATUSES) statusCounts[s] = 0;
    for (const r of results) {
      const s = r.status as string;
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    const totalEvaluated = results.length;
    const passCount = statusCounts["pass"] ?? 0;
    const readinessPercent =
      totalEvaluated > 0 ? Math.round((passCount / totalEvaluated) * 100) : null;

    // Top gaps = fail/partial sorted by severity
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    const topGaps = results
      .filter((r) => r.status === "fail" || r.status === "partial")
      .sort((a, b) => {
        const sa = severityOrder[a.severity as string] ?? 5;
        const sb = severityOrder[b.severity as string] ?? 5;
        return sa - sb;
      })
      .slice(0, 10);

    // Latest scan run per framework for this tenant
    const latestRunQuery = supabase
      .from("compliance_scan_results")
      .select("scan_run_id, framework, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (framework) latestRunQuery.eq("framework", framework);

    const { data: runData } = await latestRunQuery;

    const seenRuns = new Set<string>();
    const recentRuns: { scanRunId: string; framework: string; assessedAt: string }[] = [];
    for (const row of runData ?? []) {
      const key = `${row.scan_run_id as string}:${row.framework as string}`;
      if (!seenRuns.has(key)) {
        seenRuns.add(key);
        recentRuns.push({
          scanRunId: row.scan_run_id as string,
          framework: row.framework as string,
          assessedAt: row.created_at as string,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalEvaluated,
        readinessPercent,
        pass: statusCounts["pass"] ?? 0,
        fail: statusCounts["fail"] ?? 0,
        partial: statusCounts["partial"] ?? 0,
        unknown: statusCounts["unknown"] ?? 0,
        evidence_missing: statusCounts["evidence_missing"] ?? 0,
      },
      topGaps,
      recentRuns: recentRuns.slice(0, 5),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
