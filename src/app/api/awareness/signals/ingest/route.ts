import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type IngestBody = {
  tenantId?: unknown;
  signalType?: unknown;
  source?: unknown;
  signals?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  try {
    let body: IngestBody;
    try {
      body = (await request.json()) as IngestBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const signalType =
      typeof body.signalType === "string" ? body.signalType.trim().toLowerCase() : "";
    if (signalType !== "real_world" && signalType !== "company") {
      return NextResponse.json(
        { ok: false, error: "signalType must be either real_world or company" },
        { status: 400 }
      );
    }

    const source = typeof body.source === "string" ? body.source.trim() : "unknown_source";
    if (source.length > 200) {
      return NextResponse.json({ ok: false, error: "source must be 200 characters or less" }, { status: 400 });
    }

    if (!Array.isArray(body.signals) || body.signals.length === 0) {
      return NextResponse.json({ ok: false, error: "signals must be a non-empty array" }, { status: 400 });
    }
    const signals = body.signals
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0)
      .slice(0, 100);
    if (signals.length === 0) {
      return NextResponse.json({ ok: false, error: "signals must contain at least one string value" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("evidence_records")
      .insert(
        signals.map((signal) => ({
          tenant_id: tenantId,
          control_framework: "securewatch_internal",
          control_id: "SW-AWARENESS-SIGNAL",
          evidence_type: "awareness_signal",
          title: `Awareness signal (${signalType})`,
          description: `Signal ingested from ${source} for adaptive security training.`,
          payload: {
            signalType,
            signal,
            source,
            observedAt: now,
          },
        }))
      )
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "system",
      entityId: `awareness-signals:${now}`,
      action: "awareness.signals.ingested",
      summary: `Ingested ${signals.length} awareness signal(s) from ${source}`,
      payload: {
        signalType,
        source,
        count: signals.length,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        ingestedCount: signals.length,
        evidenceRecordIds: (data ?? []).map((row) => row.id),
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to ingest awareness signals", message },
      { status: 500 }
    );
  }
}
