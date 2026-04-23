import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  LEARNING_INTERACTION_KINDS,
  LEARNING_SOURCES,
  recordClientLearning,
} from "@/lib/clientLearning";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type PostBody = {
  tenantId?: unknown;
  source?: unknown;
  interactionKind?: unknown;
  title?: unknown;
  body?: unknown;
  structuredSignals?: unknown;
  impact?: unknown;
  productArea?: unknown;
  targetRelease?: unknown;
  relatedEntityType?: unknown;
  relatedEntityId?: unknown;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const triageStatus = searchParams.get("triageStatus")?.trim() ?? "";
    const limitParam = searchParams.get("limit")?.trim() ?? "100";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    const limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return NextResponse.json(
        { ok: false, error: "limit must be an integer between 1 and 200" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from("client_interaction_learnings")
      .select(
        "id, tenant_id, source, interaction_kind, title, body, structured_signals, impact, product_area, target_release, triage_status, related_entity_type, related_entity_id, created_by, shipped_in_version, release_notes_ref, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (triageStatus.length > 0) {
      q = q.eq("triage_status", triageStatus);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, learnings: data ?? [], count: (data ?? []).length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to list client learnings", message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const source = typeof body.source === "string" ? (body.source.trim() as (typeof LEARNING_SOURCES)[number]) : "";
    if (!LEARNING_SOURCES.includes(source as (typeof LEARNING_SOURCES)[number])) {
      return NextResponse.json(
        { ok: false, error: `source must be one of: ${LEARNING_SOURCES.join(", ")}` },
        { status: 400 }
      );
    }

    const interactionKind =
      typeof body.interactionKind === "string"
        ? (body.interactionKind.trim() as (typeof LEARNING_INTERACTION_KINDS)[number])
        : "";
    if (!LEARNING_INTERACTION_KINDS.includes(interactionKind as (typeof LEARNING_INTERACTION_KINDS)[number])) {
      return NextResponse.json(
        { ok: false, error: `interactionKind must be one of: ${LEARNING_INTERACTION_KINDS.join(", ")}` },
        { status: 400 }
      );
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 3 || title.length > 500) {
      return NextResponse.json(
        { ok: false, error: "title must be between 3 and 500 characters" },
        { status: 400 }
      );
    }

    const textBody = typeof body.body === "string" ? body.body.trim() : "";
    if (textBody.length > 20_000) {
      return NextResponse.json({ ok: false, error: "body is too long" }, { status: 400 });
    }

    const impact =
      body.impact === "low" || body.impact === "medium" || body.impact === "high" ? body.impact : "medium";

    let structuredSignals: Record<string, unknown> = {};
    if (body.structuredSignals !== undefined) {
      if (body.structuredSignals === null || typeof body.structuredSignals !== "object" || Array.isArray(body.structuredSignals)) {
        return NextResponse.json(
          { ok: false, error: "structuredSignals must be a JSON object" },
          { status: 400 }
        );
      }
      structuredSignals = body.structuredSignals as Record<string, unknown>;
    }

    const productArea = typeof body.productArea === "string" ? body.productArea.trim() : null;
    const targetRelease = typeof body.targetRelease === "string" ? body.targetRelease.trim() : null;
    const relatedEntityType = typeof body.relatedEntityType === "string" ? body.relatedEntityType.trim() : null;
    const relatedEntityId =
      typeof body.relatedEntityId === "string" && isUuid(body.relatedEntityId) ? body.relatedEntityId : null;

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const created = await recordClientLearning({
      tenantId,
      source: source as (typeof LEARNING_SOURCES)[number],
      interactionKind: interactionKind as (typeof LEARNING_INTERACTION_KINDS)[number],
      title,
      body: textBody,
      structuredSignals,
      impact,
      productArea: productArea && productArea.length > 0 ? productArea : null,
      targetRelease: targetRelease && targetRelease.length > 0 ? targetRelease : null,
      relatedEntityType: relatedEntityType && relatedEntityType.length > 0 ? relatedEntityType : null,
      relatedEntityId: relatedEntityId ?? undefined,
      createdBy: guard.userId ?? null,
    });

    if (!created) {
      return NextResponse.json(
        { ok: false, error: "Could not persist learning (see server logs)" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to record client learning", message },
      { status: 500 }
    );
  }
}
