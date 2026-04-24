import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { SCAN_RUN_STATUSES } from "@/lib/statuses";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type ScanRunRow = {
  id: string;
  tenant_id: string;
  scan_target_id: string | null;
  status: string;
  scanner_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  scan_target: {
    target_name: string | null;
    target_value: string | null;
  }[] | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    if (!isUuid(tenantId)) {
      return NextResponse.json(
        { ok: false, error: "tenantId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (
      status.length > 0 &&
      !SCAN_RUN_STATUSES.includes(status as (typeof SCAN_RUN_STATUSES)[number])
    ) {
      return NextResponse.json(
        { ok: false, error: `status must be one of: ${SCAN_RUN_STATUSES.join(", ")}` },
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
    let scanRunQuery = supabase
      .from("scan_runs")
      .select(
        "id, tenant_id, scan_target_id, status, scanner_name, created_at, started_at, completed_at, error_message, scan_target:scan_targets(target_name, target_value)"
      )
      .order("created_at", { ascending: false })
      .limit(300);

    scanRunQuery = scanRunQuery.eq("tenant_id", tenantId);
    if (status.length > 0) {
      scanRunQuery = scanRunQuery.eq("status", status);
    }

    const { data: scanRuns, error: scanRunsError } = await scanRunQuery;
    if (scanRunsError) {
      throw new Error(scanRunsError.message);
    }

    const rows = (scanRuns ?? []) as ScanRunRow[];
    const enriched = rows.map((row) => {
      const target = row.scan_target?.[0];
      const targetName = target?.target_name ?? null;
      const targetValue = target?.target_value ?? null;

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        scan_target_id: row.scan_target_id,
        status: row.status,
        scanner_name: row.scanner_name,
        created_at: row.created_at,
        started_at: row.started_at,
        completed_at: row.completed_at,
        error_message: row.error_message,
        target_name: targetName,
        target_value: targetValue,
      };
    });

    return NextResponse.json({ ok: true, scanRuns: enriched, count: enriched.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load scan runs", message },
      { status: 500 }
    );
  }
}
