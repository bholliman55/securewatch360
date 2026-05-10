import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getOrSetTargetFramework } from "@/lib/postureRoadmapService";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * GET /api/posture-roadmap/target?tenantId=
 * GET the current target framework for a tenant.
 *
 * PATCH /api/posture-roadmap/target
 * Body: { tenantId, targetFramework }
 * Set the target framework for a tenant.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";

  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
  }

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst", "viewer"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const supabase = getSupabaseAdminClient();
  const targetFramework = await getOrSetTargetFramework(supabase, tenantId);

  return NextResponse.json({ ok: true, tenantId, targetFramework });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { tenantId?: string; targetFramework?: string };
    const tenantId = body.tenantId?.trim() ?? "";
    const targetFramework = body.targetFramework?.trim().toUpperCase() ?? "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!targetFramework) {
      return NextResponse.json({ ok: false, error: "targetFramework is required" }, { status: 400 });
    }

    const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst"] });
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const supabase = getSupabaseAdminClient();
    await getOrSetTargetFramework(supabase, tenantId, targetFramework);

    return NextResponse.json({ ok: true, tenantId, targetFramework });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: "Failed to update target framework", message }, { status: 500 });
  }
}
