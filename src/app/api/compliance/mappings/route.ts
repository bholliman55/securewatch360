import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type MapFindingBody = {
  findingId?: unknown;
  controlRequirementId?: unknown;
  notes?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request) {
  try {
    let body: MapFindingBody;
    try {
      body = (await request.json()) as MapFindingBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const findingId = typeof body.findingId === "string" ? body.findingId.trim() : "";
    const controlRequirementId =
      typeof body.controlRequirementId === "string" ? body.controlRequirementId.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!findingId || !isUuid(findingId)) {
      return NextResponse.json({ ok: false, error: "findingId must be a valid UUID" }, { status: 400 });
    }
    if (!controlRequirementId || !isUuid(controlRequirementId)) {
      return NextResponse.json(
        { ok: false, error: "controlRequirementId must be a valid UUID" },
        { status: 400 }
      );
    }
    if (notes.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "notes must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: finding, error: findingError } = await supabase
      .from("findings")
      .select("id, tenant_id")
      .eq("id", findingId)
      .single();

    if (findingError || !finding) {
      return NextResponse.json(
        { ok: false, error: findingError?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId: finding.tenant_id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const { data: control, error: controlError } = await supabase
      .from("control_requirements")
      .select("id")
      .eq("id", controlRequirementId)
      .single();

    if (controlError || !control) {
      return NextResponse.json(
        { ok: false, error: controlError?.message ?? "Control requirement not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("finding_control_mappings")
      .upsert(
        {
          tenant_id: finding.tenant_id,
          finding_id: finding.id,
          control_requirement_id: control.id,
          mapping_source: "manual",
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,finding_id,control_requirement_id" }
      )
      .select("id, tenant_id, finding_id, control_requirement_id, mapping_source, notes, created_at, updated_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to map finding to control");
    }

    return NextResponse.json({ ok: true, mapping: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to map finding to control", message },
      { status: 500 }
    );
  }
}
