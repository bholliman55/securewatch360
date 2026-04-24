import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type ScheduleBody = {
  tenantId?: unknown;
  frequency?: unknown;
  scope?: unknown;
  scanTargetId?: unknown;
  enabled?: unknown;
};

const allowedFrequencies = ["daily", "weekly"] as const;
const allowedScopes = ["tenant", "target"] as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request) {
  try {
    let body: ScheduleBody;
    try {
      body = (await request.json()) as ScheduleBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const frequency =
      typeof body.frequency === "string" ? body.frequency.trim().toLowerCase() : "";
    const requestedScope =
      typeof body.scope === "string" ? body.scope.trim().toLowerCase() : "";
    const scanTargetId = typeof body.scanTargetId === "string" ? body.scanTargetId.trim() : "";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }
    if (!allowedFrequencies.includes(frequency as (typeof allowedFrequencies)[number])) {
      return NextResponse.json(
        { ok: false, error: `frequency must be one of: ${allowedFrequencies.join(", ")}` },
        { status: 400 }
      );
    }

    const derivedScope = requestedScope || (scanTargetId ? "target" : "tenant");
    if (!allowedScopes.includes(derivedScope as (typeof allowedScopes)[number])) {
      return NextResponse.json(
        { ok: false, error: `scope must be one of: ${allowedScopes.join(", ")}` },
        { status: 400 }
      );
    }
    if (derivedScope === "target" && (!scanTargetId || !isUuid(scanTargetId))) {
      return NextResponse.json(
        { ok: false, error: "scanTargetId must be a valid UUID when scope=target" },
        { status: 400 }
      );
    }
    if (derivedScope === "tenant" && scanTargetId) {
      return NextResponse.json(
        { ok: false, error: "scanTargetId must be empty when scope=tenant" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();

    if (derivedScope === "target") {
      const { data: target, error: targetError } = await supabase
        .from("scan_targets")
        .select("id")
        .eq("id", scanTargetId)
        .eq("tenant_id", tenantId)
        .single();

      if (targetError || !target) {
        return NextResponse.json(
          { ok: false, error: targetError?.message ?? "Target not found for tenant" },
          { status: 404 }
        );
      }
    }

    let existingQuery = supabase
      .from("scan_schedules")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("scope", derivedScope)
      .eq("frequency", frequency);

    if (derivedScope === "target") {
      existingQuery = existingQuery.eq("scan_target_id", scanTargetId);
    } else {
      existingQuery = existingQuery.is("scan_target_id", null);
    }

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) {
      throw new Error(existingError.message);
    }

    const now = new Date().toISOString();
    if (existing?.id) {
      const { data, error } = await supabase
        .from("scan_schedules")
        .update({
          enabled,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select("id, tenant_id, scan_target_id, scope, frequency, enabled, last_triggered_at, created_at, updated_at")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to update scan schedule");
      }

      return NextResponse.json({ ok: true, scanSchedule: data, updated: true }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("scan_schedules")
      .insert({
        tenant_id: tenantId,
        scan_target_id: derivedScope === "target" ? scanTargetId : null,
        scope: derivedScope,
        frequency,
        enabled,
        updated_at: now,
      })
      .select("id, tenant_id, scan_target_id, scope, frequency, enabled, last_triggered_at, created_at, updated_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create scan schedule");
    }

    return NextResponse.json({ ok: true, scanSchedule: data, updated: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to save scan schedule", message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
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
    const { data, error } = await supabase
      .from("scan_schedules")
      .select("id, tenant_id, scan_target_id, scope, frequency, enabled, last_triggered_at, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        scanSchedules: data ?? [],
        count: data?.length ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load scan schedules", message },
      { status: 500 }
    );
  }
}
