import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { writeAuditLog } from "@/lib/audit";

const SUPPORTED_FRAMEWORKS = ["CMMC_L1", "CMMC_L2", "CIS_v8", "NIST_CSF_2", "HIPAA", "SOC2"] as const;
type SupportedFramework = (typeof SUPPORTED_FRAMEWORKS)[number];

const FRAMEWORK_LABELS: Record<SupportedFramework, string> = {
  CMMC_L1: "CMMC Level 1",
  CMMC_L2: "CMMC Level 2",
  CIS_v8: "CIS Controls v8",
  NIST_CSF_2: "NIST CSF 2.0",
  HIPAA: "HIPAA Security Rule",
  SOC2: "SOC 2",
};

type RequestBody = {
  tenantId?: unknown;
  framework?: unknown;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isSupportedFramework(v: string): v is SupportedFramework {
  return SUPPORTED_FRAMEWORKS.includes(v as SupportedFramework);
}

function validate(body: RequestBody): string[] {
  const errors: string[] = [];

  if (typeof body.tenantId !== "string" || !body.tenantId.trim()) {
    errors.push("tenantId is required");
  } else if (!isUuid(body.tenantId.trim())) {
    errors.push("tenantId must be a valid UUID");
  }

  if (typeof body.framework !== "string" || !body.framework.trim()) {
    errors.push(`framework is required. Supported: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
  } else if (!isSupportedFramework(body.framework.trim())) {
    errors.push(`Invalid framework. Supported: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
  }

  return errors;
}

export async function POST(request: Request) {
  try {
    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const errors = validate(body);
    if (errors.length > 0) {
      return NextResponse.json({ ok: false, error: "Validation failed", details: errors }, { status: 400 });
    }

    const tenantId = (body.tenantId as string).trim();
    const framework = (body.framework as string).trim() as SupportedFramework;

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: [...API_TENANT_ROLES.remediationAndScan],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    // Find or create a compliance_scope scan target for this framework
    const targetName = `Compliance: ${FRAMEWORK_LABELS[framework]}`;
    const targetValue = framework;

    let scanTargetId: string;

    const { data: existing } = await supabase
      .from("scan_targets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("target_type", "compliance_scope")
      .eq("target_value", targetValue)
      .maybeSingle();

    if (existing?.id) {
      scanTargetId = existing.id as string;
    } else {
      const { data: created, error: createError } = await supabase
        .from("scan_targets")
        .insert({
          tenant_id: tenantId,
          target_name: targetName,
          target_type: "compliance_scope",
          target_value: targetValue,
          status: "active",
        })
        .select("id")
        .single();

      if (createError || !created) {
        return NextResponse.json(
          { ok: false, error: `Could not create compliance scan target: ${createError?.message ?? "unknown"}` },
          { status: 500 }
        );
      }
      scanTargetId = created.id as string;
    }

    const result = await inngest.send({
      name: "securewatch/scan.requested",
      data: { tenantId, scanTargetId },
    });

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "scan",
      entityId: scanTargetId,
      action: "compliance_scan.triggered",
      summary: `Compliance scan requested for framework ${framework}`,
      payload: { triggerType: "manual_api", framework, scanTargetId },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Compliance scan requested successfully",
        framework,
        frameworkName: FRAMEWORK_LABELS[framework],
        scanTargetId,
        event: result,
      },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: "Failed to request compliance scan", message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    supportedFrameworks: SUPPORTED_FRAMEWORKS.map((code) => ({
      code,
      name: FRAMEWORK_LABELS[code],
    })),
  });
}
