import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";
import {
  executeComplianceScan,
  getComplianceFramework,
  type ComplianceScanFramework,
} from "@/lib/complianceScan";

type ComplianceScanBody = {
  tenantId?: unknown;
  framework?: unknown;
  scope?: unknown;
  scanTargetIds?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTargetIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );
}

export async function POST(request: Request) {
  let tenantId = "";
  let frameworkValue = "";
  let scope = "";

  try {
    let body: ComplianceScanBody;
    try {
      body = (await request.json()) as ComplianceScanBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    frameworkValue = typeof body.framework === "string" ? body.framework.trim().toLowerCase() : "";
    scope = typeof body.scope === "string" ? body.scope.trim() : "";
    const scanTargetIds = normalizeTargetIds(body.scanTargetIds);
    const errors: string[] = [];

    if (!tenantId || !isUuid(tenantId)) errors.push("tenantId must be a valid UUID");
    if (!getComplianceFramework(frameworkValue)) errors.push("framework is not supported");
    if (!scope) errors.push("scope is required");
    for (const targetId of scanTargetIds) {
      if (!isUuid(targetId)) errors.push(`scanTargetId is invalid: ${targetId}`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, error: "Validation failed", details: errors }, { status: 400 });
    }

    console.info("[scans/compliance] scan request received", {
      scan_id: null,
      scan_type: "compliance",
      target: scanTargetIds.join(",") || scope,
      client_id: null,
      tenant_id: tenantId,
      backend_route_called: "/api/scans/compliance",
    });

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.remediationAndScan],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    if (scanTargetIds.length > 0) {
      const { data: targets, error: targetError } = await supabase
        .from("scan_targets")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("id", scanTargetIds);
      if (targetError) {
        throw new Error(targetError.message);
      }
      if ((targets ?? []).length !== scanTargetIds.length) {
        return NextResponse.json(
          { ok: false, error: "One or more scan targets are outside the tenant scope" },
          { status: 404 }
        );
      }
    }

    const result = await executeComplianceScan(supabase, {
      tenantId,
      framework: frameworkValue as ComplianceScanFramework,
      scope,
      scanTargetIds,
      actorUserId: guard.userId,
    });

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "scan",
      entityId: result.scanRunId,
      action: "scan.compliance.completed",
      summary: "Compliance scan completed",
      payload: {
        framework: frameworkValue,
        scope,
        scanTargetIds,
        summary: result.summary,
      },
    });

    console.info("[scans/compliance] scan completed", {
      scan_id: result.scanRunId,
      scan_type: "compliance",
      target: scanTargetIds.join(",") || scope,
      client_id: null,
      tenant_id: tenantId,
      backend_route_called: "/api/scans/compliance",
      response_status: 201,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Compliance scan completed",
        scanRunId: result.scanRunId,
        summary: result.summary,
        results: result.results,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[scans/compliance] scan failed", {
      scan_id: null,
      scan_type: "compliance",
      target: scope || null,
      client_id: null,
      tenant_id: tenantId || null,
      backend_route_called: "/api/scans/compliance",
      response_status: 500,
      error_message: message,
    });
    return NextResponse.json(
      { ok: false, error: "Failed to run compliance scan", message },
      { status: 500 }
    );
  }
}
