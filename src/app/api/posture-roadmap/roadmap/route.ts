import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { getRoadmapItems } from "@/lib/postureRoadmapService";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * GET /api/posture-roadmap/roadmap?tenantId=&status=&priority=&category=
 * Returns roadmap items, optionally filtered.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const statusFilter = searchParams.get("status")?.trim() ?? "";
    const priorityFilter = searchParams.get("priority")?.trim() ?? "";
    const categoryFilter = searchParams.get("category")?.trim() ?? "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const supabase = getSupabaseAdminClient();
    let items = await getRoadmapItems(supabase, tenantId);

    if (statusFilter) items = items.filter((i) => i.status === statusFilter);
    if (priorityFilter) items = items.filter((i) => i.priority === priorityFilter);
    if (categoryFilter) items = items.filter((i) => i.category === categoryFilter);

    return NextResponse.json({ ok: true, tenantId, items, total: items.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: "Failed to load roadmap items", message }, { status: 500 });
  }
}
