import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

const OPEN_REMEDIATION_STATUSES = ["proposed", "approved", "in_progress"] as const;

type ScanRunRow = {
  id: string;
  status: string;
  scanner_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  scan_target: { target_name: string | null }[] | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const recentLimitParam = searchParams.get("recentLimit")?.trim() ?? "";
    const recentLimit = recentLimitParam.length > 0 ? Number(recentLimitParam) : 8;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > 20) {
      return NextResponse.json(
        { ok: false, error: "recentLimit must be an integer between 1 and 20" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    const [totalFindingsRes, highCriticalRes, openRemediationRes, recentScansRes] = await Promise.all([
      supabase.from("findings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase
        .from("findings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("severity", ["high", "critical"]),
      supabase
        .from("remediation_actions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("action_status", [...OPEN_REMEDIATION_STATUSES]),
      supabase
        .from("scan_runs")
        .select(
          "id, status, scanner_name, created_at, started_at, completed_at, error_message, scan_target:scan_targets(target_name)"
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(recentLimit),
    ]);

    if (totalFindingsRes.error) throw new Error(totalFindingsRes.error.message);
    if (highCriticalRes.error) throw new Error(highCriticalRes.error.message);
    if (openRemediationRes.error) throw new Error(openRemediationRes.error.message);
    if (recentScansRes.error) throw new Error(recentScansRes.error.message);

    const recentScans = ((recentScansRes.data ?? []) as ScanRunRow[]).map((scan) => ({
      id: scan.id,
      status: scan.status,
      scanner_name: scan.scanner_name,
      target_name: scan.scan_target?.[0]?.target_name ?? null,
      created_at: scan.created_at,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      error_message: scan.error_message,
    }));

    return NextResponse.json(
      {
        ok: true,
        summary: {
          tenantId,
          totalFindings: totalFindingsRes.count ?? 0,
          highCriticalFindings: highCriticalRes.count ?? 0,
          openRemediationActions: openRemediationRes.count ?? 0,
        },
        recentScans,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load command center summary", message },
      { status: 500 }
    );
  }
}
