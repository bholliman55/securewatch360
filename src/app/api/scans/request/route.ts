import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

type RequestScanBody = {
  tenantId?: unknown;
  scanTargetId?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function validate(body: RequestScanBody): string[] {
  const errors: string[] = [];

  if (typeof body.tenantId !== "string" || body.tenantId.trim().length === 0) {
    errors.push("tenantId is required");
  } else if (!isUuid(body.tenantId.trim())) {
    errors.push("tenantId must be a valid UUID");
  }

  if (typeof body.scanTargetId !== "string" || body.scanTargetId.trim().length === 0) {
    errors.push("scanTargetId is required");
  } else if (!isUuid(body.scanTargetId.trim())) {
    errors.push("scanTargetId must be a valid UUID");
  }

  return errors;
}

export async function POST(request: Request) {
  try {
    let body: RequestScanBody;

    try {
      body = (await request.json()) as RequestScanBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const errors = validate(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const tenantId = (body.tenantId as string).trim();
    const scanTargetId = (body.scanTargetId as string).trim();

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.remediationAndScan],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data: target, error: targetError } = await supabase
      .from("scan_targets")
      .select("id")
      .eq("id", scanTargetId)
      .eq("tenant_id", tenantId)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { ok: false, error: targetError?.message ?? "scanTargetId is not in the tenant scope" },
        { status: 404 }
      );
    }

    const result = await inngest.send({
      name: "securewatch/scan.requested",
      data: {
        tenantId,
        scanTargetId,
      },
    });

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "scan",
      entityId: scanTargetId,
      action: "scan.triggered",
      summary: "Manual scan requested",
      payload: {
        triggerType: "manual_api",
        scanTargetId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Scan requested successfully",
        event: {
          name: "securewatch/scan.requested",
          tenantId,
          scanTargetId,
        },
        ingest: result,
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to request scan", message },
      { status: 500 }
    );
  }
}
