import { NextResponse } from "next/server";
import { computeCompliancePosture } from "@/lib/compliancePosture";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const frameworkCode = searchParams.get("framework")?.trim().toUpperCase() ?? "";

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

    let result;
    try {
      result = await computeCompliancePosture(supabase, tenantId, frameworkCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "FRAMEWORK_NOT_FOUND") {
        return NextResponse.json({ ok: false, error: "Framework not found" }, { status: 404 });
      }
      throw e;
    }

    const controlStatuses = result.controls.map((control) => ({
      controlRequirementId: control.controlRequirementId,
      frameworkCode: control.frameworkCode,
      frameworkName: control.frameworkName,
      controlCode: control.controlCode,
      controlTitle: control.controlTitle,
      mappedFindings: control.mappedFindings,
      failingFindings: control.failingFindings,
      status: control.status,
    }));

    return NextResponse.json(
      {
        ok: true,
        tenantId,
        framework: result.framework ?? (frameworkCode.length > 0 ? frameworkCode : null),
        controls: controlStatuses,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load compliance control status", message },
      { status: 500 }
    );
  }
}
