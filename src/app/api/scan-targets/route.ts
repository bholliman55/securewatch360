import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

type CreateScanTargetBody = {
  tenantId?: unknown;
  targetName?: unknown;
  targetType?: unknown;
  targetValue?: unknown;
};

const allowedTargetTypes = [
  "url",
  "domain",
  "hostname",
  "ip",
  "cidr",
  "cloud_account",
  "webapp",
  "repo",
  "container_image",
  "package_manifest",
] as const;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function validate(body: CreateScanTargetBody): string[] {
  const errors: string[] = [];

  if (typeof body.tenantId !== "string" || body.tenantId.trim().length === 0) {
    errors.push("tenantId is required");
  } else if (!isUuid(body.tenantId.trim())) {
    errors.push("tenantId must be a valid UUID");
  }

  if (typeof body.targetName !== "string" || body.targetName.trim().length === 0) {
    errors.push("targetName is required");
  }

  if (typeof body.targetType !== "string" || body.targetType.trim().length === 0) {
    errors.push("targetType is required");
  } else if (!allowedTargetTypes.includes(body.targetType.trim().toLowerCase() as never)) {
    errors.push(`targetType must be one of: ${allowedTargetTypes.join(", ")}`);
  }

  if (typeof body.targetValue !== "string" || body.targetValue.trim().length === 0) {
    errors.push("targetValue is required");
  }

  return errors;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";

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
    let query = supabase
      .from("scan_targets")
      .select("id, tenant_id, target_name, target_type, target_value, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (status.length > 0) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, scanTargets: data ?? [], count: data?.length ?? 0 }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load scan targets", message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: CreateScanTargetBody;

    try {
      body = (await request.json()) as CreateScanTargetBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const errors = validate(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const tenantId = (body.tenantId as string).trim();
    const targetName = (body.targetName as string).trim();
    const targetType = (body.targetType as string).trim().toLowerCase();
    const targetValue = (body.targetValue as string).trim();

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("scan_targets")
      .insert({
        tenant_id: tenantId,
        target_name: targetName,
        target_type: targetType,
        target_value: targetValue,
        status: "active",
      })
      .select("id, tenant_id, target_name, target_type, target_value, status, created_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, scanTarget: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to create scan target", message },
      { status: 500 }
    );
  }
}
