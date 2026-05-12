import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { FINDING_STATUSES } from "@/lib/statuses";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { parsePagination } from "@/lib/apiPagination";

const allowedSeverities = ["info", "low", "medium", "high", "critical"] as const;
const allowedAgentTypes = ["mock", "network", "web", "vulnerability"] as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const scanRunId =
      searchParams.get("scanRunId")?.trim() ??
      searchParams.get("scanId")?.trim() ??
      searchParams.get("scanResultId")?.trim() ??
      "";
    const scanTargetId = searchParams.get("scanTargetId")?.trim() ?? "";
    const severity = searchParams.get("severity")?.trim().toLowerCase() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const agentType = searchParams.get("agentType")?.trim().toLowerCase() ?? "";
    const assetId = searchParams.get("assetId")?.trim() ?? "";
    // scanDateAfter / scanDateBefore filter on the scan run's started_at
    const scanDateAfter = searchParams.get("scanDateAfter")?.trim() ?? "";
    const scanDateBefore = searchParams.get("scanDateBefore")?.trim() ?? "";
    const pagination = parsePagination({
      rawLimit: searchParams.get("limit"),
      rawOffset: searchParams.get("offset"),
      defaultLimit: 200,
      maxLimit: 500,
    });

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
    }

    if (!isUuid(tenantId)) {
      return NextResponse.json(
        { ok: false, error: "tenantId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (scanRunId.length > 0 && !isUuid(scanRunId)) {
      return NextResponse.json(
        { ok: false, error: "scanRunId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (scanTargetId.length > 0 && !isUuid(scanTargetId)) {
      return NextResponse.json(
        { ok: false, error: "scanTargetId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (assetId.length > 0 && !isUuid(assetId)) {
      return NextResponse.json(
        { ok: false, error: "assetId must be a valid UUID" },
        { status: 400 }
      );
    }

    if (severity.length > 0 && !allowedSeverities.includes(severity as (typeof allowedSeverities)[number])) {
      return NextResponse.json(
        { ok: false, error: `severity must be one of: ${allowedSeverities.join(", ")}` },
        { status: 400 }
      );
    }

    if (status.length > 0 && !FINDING_STATUSES.includes(status as (typeof FINDING_STATUSES)[number])) {
      return NextResponse.json(
        { ok: false, error: `status must be one of: ${FINDING_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (agentType.length > 0 && !allowedAgentTypes.includes(agentType as (typeof allowedAgentTypes)[number])) {
      return NextResponse.json(
        { ok: false, error: `agentType must be one of: ${allowedAgentTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (category.length > 100) {
      return NextResponse.json(
        { ok: false, error: "category must be 100 characters or less" },
        { status: 400 }
      );
    }

    if (scanDateAfter.length > 0 && !isIsoDate(scanDateAfter)) {
      return NextResponse.json(
        { ok: false, error: "scanDateAfter must be an ISO 8601 date string" },
        { status: 400 }
      );
    }

    if (scanDateBefore.length > 0 && !isIsoDate(scanDateBefore)) {
      return NextResponse.json(
        { ok: false, error: "scanDateBefore must be an ISO 8601 date string" },
        { status: 400 }
      );
    }

    if (!pagination.ok) {
      return NextResponse.json({ ok: false, error: pagination.error }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.read],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    // Single string literal so Supabase can infer the return type at compile time.
    const SELECT_FINDINGS =
      "id, tenant_id, scan_run_id, scan_id, scan_result_id, scan_target_id, agent_type, asset_id, severity, category, title, description, status, asset_type, exposure, priority_score, assigned_to_user_id, notes, created_at, updated_at, scan_run:scan_runs!findings_scan_run_id_fkey(id, scanner_name, scanner_type, status, created_at, started_at, completed_at, scan_target:scan_targets(id, target_name, target_type, target_value)), asset:asset_inventory!findings_asset_id_fkey(id, asset_identifier, asset_type, display_name)" as const;

    let query = supabase
      .from("findings")
      .select(SELECT_FINDINGS)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);

    query = query.eq("tenant_id", tenantId);

    if (scanRunId.length > 0) query = query.eq("scan_run_id", scanRunId);
    if (scanTargetId.length > 0) query = query.eq("scan_target_id", scanTargetId);
    if (assetId.length > 0) query = query.eq("asset_id", assetId);
    if (agentType.length > 0) query = query.eq("agent_type", agentType);
    if (severity.length > 0) query = query.eq("severity", severity);
    if (status.length > 0) query = query.eq("status", status);
    if (category.length > 0) query = query.eq("category", category);

    // scanDate filters are applied on the related scan_run's started_at via a sub-select
    // because Supabase PostgREST does not support filtering on joined columns directly.
    // We filter the findings by their scan_run_id being in the matching run set.
    if (scanDateAfter.length > 0 || scanDateBefore.length > 0) {
      let runQuery = supabase
        .from("scan_runs")
        .select("id")
        .eq("tenant_id", tenantId);
      if (scanDateAfter.length > 0) runQuery = runQuery.gte("started_at", scanDateAfter);
      if (scanDateBefore.length > 0) runQuery = runQuery.lte("started_at", scanDateBefore);
      const { data: matchingRuns } = await runQuery;
      const runIds = (matchingRuns ?? []).map((r) => r.id as string);
      if (runIds.length === 0) {
        return NextResponse.json(
          { ok: true, findings: [], count: 0, pagination: { limit: pagination.limit, offset: pagination.offset } },
          { status: 200 }
        );
      }
      query = query.in("scan_run_id", runIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const findings = (data ?? []).map((row) => {
      const scanRun = Array.isArray(row.scan_run) ? row.scan_run[0] : row.scan_run;
      const scanTarget = Array.isArray(scanRun?.scan_target)
        ? scanRun?.scan_target[0]
        : scanRun?.scan_target;
      const assetRow = Array.isArray(row.asset) ? row.asset[0] : row.asset;

      return {
        ...row,
        scan: scanRun
          ? {
              id: scanRun.id,
              name: scanRun.scanner_name ?? scanRun.scanner_type ?? "Scan",
              type: scanRun.scanner_type ?? scanRun.scanner_name ?? "scan",
              status: scanRun.status,
              date: scanRun.started_at ?? scanRun.created_at,
              completed_at: scanRun.completed_at,
              target_id: scanTarget?.id ?? row.scan_target_id ?? null,
              target_name: scanTarget?.target_name ?? null,
              target_type: scanTarget?.target_type ?? null,
              target_value: scanTarget?.target_value ?? null,
            }
          : null,
        asset: assetRow
          ? {
              id: assetRow.id,
              identifier: assetRow.asset_identifier,
              type: assetRow.asset_type,
              display_name: assetRow.display_name,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        findings,
        count: findings.length,
        pagination: {
          limit: pagination.limit,
          offset: pagination.offset,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load findings", message },
      { status: 500 }
    );
  }
}
