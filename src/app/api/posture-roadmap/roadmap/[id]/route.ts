import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { updateRoadmapItemStatus } from "@/lib/postureRoadmapService";
import { ROADMAP_STATUSES, ROADMAP_PRIORITIES } from "@/types/posture-roadmap";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/posture-roadmap/roadmap/[id]
 * Body: { tenantId, status?, priority? }
 * Updates status or priority of a roadmap item.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id: itemId } = await params;
    const body = (await request.json()) as {
      tenantId?: string;
      status?: string;
      priority?: string;
    };

    const tenantId = body.tenantId?.trim() ?? "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!itemId || !isUuid(itemId)) {
      return NextResponse.json({ ok: false, error: "item id must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

    const supabase = getSupabaseAdminClient();

    const updates: Record<string, string> = {};
    if (body.status) {
      if (!(ROADMAP_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({ ok: false, error: "Invalid status value" }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.priority) {
      if (!(ROADMAP_PRIORITIES as readonly string[]).includes(body.priority)) {
        return NextResponse.json({ ok: false, error: "Invalid priority value" }, { status: 400 });
      }
      updates.priority = body.priority;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "No updatable fields provided" }, { status: 400 });
    }

    const item = body.status
      ? await updateRoadmapItemStatus(supabase, tenantId, itemId, body.status)
      : null;

    if (body.priority && !body.status) {
      const { data, error } = await supabase
        .from("posture_roadmap_items")
        .update({ priority: body.priority, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, item: data }, { status: 200 });
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: "Failed to update roadmap item", message }, { status: 500 });
  }
}
