import { NextResponse } from "next/server";
import { authorizePolicyPackExportRequest } from "@/lib/policyExportAuth";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  buildAnsibleRolesPlaybook,
  loadPolicyControlsForExport,
} from "@/lib/policyExportArtifacts";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const framework = searchParams.get("framework")?.trim().toUpperCase() ?? "";
    const download = searchParams.get("download") === "1";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    const serviceOk = authorizePolicyPackExportRequest(request, tenantId);
    if (!guard.ok && !serviceOk) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const controls = await loadPolicyControlsForExport(framework.length > 0 ? framework : undefined);
    const body = buildAnsibleRolesPlaybook(controls);

    const suffix = framework.length > 0 ? framework.toLowerCase() : "all";
    const filename = `securewatch360-policy-pack-${suffix}.yml`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/yaml; charset=utf-8",
        ...(download
          ? { "Content-Disposition": `attachment; filename="${filename}"` }
          : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to export Ansible policy pack", message },
      { status: 500 }
    );
  }
}
