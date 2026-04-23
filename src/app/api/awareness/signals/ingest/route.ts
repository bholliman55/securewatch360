import { NextResponse } from "next/server";
import { ingestAwarenessSignals } from "@/lib/awarenessSignalIngestion";
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

    const result = await ingestAwarenessSignals({
      tenantId,
      signalType: signalType as "real_world" | "company",
      source,
      signals,
      actorUserId: guard.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        ingestedCount: result.ingestedCount,
        evidenceRecordIds: result.evidenceRecordIds,
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
