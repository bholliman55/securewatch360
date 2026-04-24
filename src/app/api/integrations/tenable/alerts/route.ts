import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";

type TenableAlertBody = {
  tenantId?: unknown;
  eventId?: unknown;
  alertType?: unknown;
  severity?: unknown;
  title?: unknown;
  description?: unknown;
  targetValue?: unknown;
  metadata?: unknown;
};

type AlertSeverity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITIES: AlertSeverity[] = ["info", "low", "medium", "high", "critical"];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseSeverity(value: unknown): AlertSeverity {
  if (typeof value !== "string") return "medium";
  const normalized = value.trim().toLowerCase();
  return SEVERITIES.includes(normalized as AlertSeverity) ? (normalized as AlertSeverity) : "medium";
}

function getBearerToken(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice("bearer ".length).trim();
}

export async function POST(request: Request) {
  const requiredToken = process.env.TENABLE_INGEST_TOKEN?.trim() ?? "";
  if (!requiredToken) {
    return NextResponse.json(
      { ok: false, error: "TENABLE_INGEST_TOKEN must be configured before accepting ingestion" },
      { status: 503 }
    );
  }

  const suppliedToken = getBearerToken(request);
  if (!suppliedToken || suppliedToken !== requiredToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: TenableAlertBody;
  try {
    body = (await request.json()) as TenableAlertBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const alertType = typeof body.alertType === "string" ? body.alertType.trim() : "tenable_alert";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const targetValue = typeof body.targetValue === "string" ? body.targetValue.trim() : "";
  const metadata = typeof body.metadata === "object" && body.metadata ? body.metadata : {};
  const severity = parseSeverity(body.severity);

  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
  }
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "eventId is required for dedupe" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingRun, error: lookupError } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("scanner_type", "monitoring")
    .contains("target_snapshot", { sourceEventId: eventId })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { ok: false, error: "Could not check dedupe state", message: lookupError.message },
      { status: 500 }
    );
  }

  if (existingRun?.id) {
    return NextResponse.json(
      {
        ok: true,
        deduped: true,
        reason: "event already ingested",
        existingScanRunId: existingRun.id,
      },
      { status: 200 }
    );
  }

  await inngest.send({
    name: "securewatch/monitoring.alert.received",
    data: {
      tenantId,
      source: "tenable",
      alertType,
      severity,
      title,
      description: description || undefined,
      targetValue: targetValue || undefined,
      metadata: { ...metadata, externalEventId: eventId },
      createFinding: true,
    },
  });

  await writeAuditLog({
    userId: null,
    tenantId,
    entityType: "system",
    entityId: eventId,
    action: "integration.tenable.alert.ingested",
    summary: `Ingested Tenable alert ${eventId}`,
    payload: {
      source: "tenable",
      alertType,
      severity,
      title,
      targetValue: targetValue || null,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      deduped: false,
      queued: true,
      event: {
        source: "tenable",
        tenantId,
        eventId,
        alertType,
      },
    },
    { status: 202 }
  );
}
