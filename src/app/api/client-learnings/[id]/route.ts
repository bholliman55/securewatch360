import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const TRIAGE = ["new", "reviewed", "planned", "in_progress", "shipped", "wontfix"] as const;
const IMPACT = ["low", "medium", "high"] as const;

type PatchBody = {
  tenantId?: unknown;
  triageStatus?: unknown;
  targetRelease?: unknown;
  productArea?: unknown;
  impact?: unknown;
  shippedInVersion?: unknown;
  releaseNotesRef?: unknown;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid learning id" }, { status: 400 });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const patch: Record<string, unknown> = {};
    if (body.triageStatus !== undefined) {
      const t = typeof body.triageStatus === "string" ? body.triageStatus.trim() : "";
      if (!TRIAGE.includes(t as (typeof TRIAGE)[number])) {
        return NextResponse.json(
          { ok: false, error: `triageStatus must be one of: ${TRIAGE.join(", ")}` },
          { status: 400 }
        );
      }
      patch.triage_status = t;
    }
    if (body.targetRelease !== undefined) {
      const v = typeof body.targetRelease === "string" ? body.targetRelease.trim() : "";
      if (v.length > 64) {
        return NextResponse.json({ ok: false, error: "targetRelease too long" }, { status: 400 });
      }
      patch.target_release = v.length > 0 ? v : null;
    }
    if (body.productArea !== undefined) {
      const v = typeof body.productArea === "string" ? body.productArea.trim() : "";
      patch.product_area = v.length > 0 ? v : null;
    }
    if (body.impact !== undefined) {
      const v = body.impact;
      if (v !== "low" && v !== "medium" && v !== "high") {
        return NextResponse.json(
          { ok: false, error: `impact must be one of: ${IMPACT.join(", ")}` },
          { status: 400 }
        );
      }
      patch.impact = v;
    }
    if (body.shippedInVersion !== undefined) {
      const v = typeof body.shippedInVersion === "string" ? body.shippedInVersion.trim() : "";
      if (v.length > 64) {
        return NextResponse.json({ ok: false, error: "shippedInVersion too long" }, { status: 400 });
      }
      patch.shipped_in_version = v.length > 0 ? v : null;
    }
    if (body.releaseNotesRef !== undefined) {
      const v = typeof body.releaseNotesRef === "string" ? body.releaseNotesRef.trim() : "";
      if (v.length > 500) {
        return NextResponse.json({ ok: false, error: "releaseNotesRef too long" }, { status: 400 });
      }
      patch.release_notes_ref = v.length > 0 ? v : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("client_interaction_learnings")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id, triage_status, target_release, product_area, impact, shipped_in_version, release_notes_ref, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Learning not found for tenant" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, learning: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to update client learning", message },
      { status: 500 }
    );
  }
}
