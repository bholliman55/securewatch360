import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function readBearer(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") ?? "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

/**
 * Optional infrastructure runners authenticate with a shared secret (`SW360_RUNNER_TOKEN`),
 * not end-user Supabase sessions. Used for telemetry only.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.SW360_RUNNER_TOKEN?.trim();
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { ok: false, error: "Runner API is not configured (SW360_RUNNER_TOKEN missing or too short)" },
      { status: 503 }
    );
  }

  const token = readBearer(req);
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    tenantId?: string;
    runnerId?: string;
    version?: string;
    hostName?: string;
    capabilities?: unknown;
    metadata?: unknown;
  };

  const tenantId = typeof b.tenantId === "string" ? b.tenantId.trim() : "";
  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
  }

  const runnerId = typeof b.runnerId === "string" ? b.runnerId.trim() : "";
  if (!runnerId || runnerId.length > 256) {
    return NextResponse.json({ ok: false, error: "runnerId is required (max 256 chars)" }, { status: 400 });
  }

  const version = typeof b.version === "string" ? b.version.trim().slice(0, 64) : null;
  const hostName = typeof b.hostName === "string" ? b.hostName.trim().slice(0, 256) : null;
  const capabilities = Array.isArray(b.capabilities)
    ? (b.capabilities.filter((x) => typeof x === "string") as string[])
    : [];
  const metadata =
    b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : {};

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("runner_heartbeats").upsert(
    {
      tenant_id: tenantId,
      runner_id: runnerId,
      version,
      host_name: hostName,
      capabilities,
      metadata,
      last_seen_at: now,
    },
    { onConflict: "tenant_id,runner_id" }
  );

  if (error) {
    console.error("[runner/heartbeat] upsert failed:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to record heartbeat" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    runnerId,
    lastSeenAt: now,
  });
}
