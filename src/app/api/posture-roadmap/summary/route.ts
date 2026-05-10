import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getPostureRoadmapSummary } from "@/lib/postureRoadmapService";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * GET /api/posture-roadmap/summary?tenantId=&targetFramework=
 *
 * Returns the full posture roadmap summary: current state, target state, gaps,
 * and roadmap item counts. Heavy computation — cache at the page level.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const targetFramework = searchParams.get("targetFramework")?.trim().toUpperCase() || undefined;

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
    const summary = await getPostureRoadmapSummary(supabase, tenantId, targetFramework);

    return NextResponse.json({ ok: true, tenantId, ...summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load posture roadmap summary", message },
      { status: 500 }
    );
  }
}
