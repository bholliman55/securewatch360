import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type ControlRequirementRow = {
  id: string;
  control_code: string;
  title: string;
  framework_id: string;
  framework: {
    framework_code: string;
    framework_name: string;
  } | null;
};

type MappingRow = {
  control_requirement_id: string;
  finding: { status: string } | { status: string }[] | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extractFindingStatus(finding: MappingRow["finding"]): string | null {
  if (!finding) return null;
  if (Array.isArray(finding)) return finding[0]?.status ?? null;
  return finding.status ?? null;
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

    let frameworkIdFilter: string | null = null;
    if (frameworkCode.length > 0) {
      const { data: framework, error: frameworkError } = await supabase
        .from("control_frameworks")
        .select("id")
        .eq("framework_code", frameworkCode)
        .single();

      if (frameworkError || !framework) {
        return NextResponse.json(
          { ok: false, error: frameworkError?.message ?? "Framework not found" },
          { status: 404 }
        );
      }
      frameworkIdFilter = framework.id;
    }

    let controlsQuery = supabase
      .from("control_requirements")
      .select(
        "id, control_code, title, framework_id, framework:control_frameworks(framework_code, framework_name)"
      )
      .order("control_code", { ascending: true });

    if (frameworkIdFilter) {
      controlsQuery = controlsQuery.eq("framework_id", frameworkIdFilter);
    }

    const { data: controlsData, error: controlsError } = await controlsQuery;
    if (controlsError) {
      throw new Error(controlsError.message);
    }

    const controls = (controlsData ?? []) as unknown as ControlRequirementRow[];

    const { data: mappingsData, error: mappingsError } = await supabase
      .from("finding_control_mappings")
      .select("control_requirement_id, finding:findings(status)")
      .eq("tenant_id", tenantId);

    if (mappingsError) {
      throw new Error(mappingsError.message);
    }

    const mappings = (mappingsData ?? []) as unknown as MappingRow[];
    const openByControl = new Map<string, number>();
    const totalByControl = new Map<string, number>();

    for (const mapping of mappings) {
      const status = extractFindingStatus(mapping.finding);
      totalByControl.set(
        mapping.control_requirement_id,
        (totalByControl.get(mapping.control_requirement_id) ?? 0) + 1
      );
      if (status && status !== "resolved" && status !== "risk_accepted") {
        openByControl.set(
          mapping.control_requirement_id,
          (openByControl.get(mapping.control_requirement_id) ?? 0) + 1
        );
      }
    }

    const controlStatuses = controls.map((control) => {
      const failingFindings = openByControl.get(control.id) ?? 0;
      const mappedFindings = totalByControl.get(control.id) ?? 0;

      return {
        controlRequirementId: control.id,
        frameworkCode: control.framework?.framework_code ?? "UNKNOWN",
        frameworkName: control.framework?.framework_name ?? "Unknown Framework",
        controlCode: control.control_code,
        controlTitle: control.title,
        mappedFindings,
        failingFindings,
        status: failingFindings > 0 ? "fail" : "pass",
      };
    });

    return NextResponse.json(
      {
        ok: true,
        tenantId,
        framework: frameworkCode || null,
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
