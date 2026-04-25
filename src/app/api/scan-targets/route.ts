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

const CRITICALITY = ["low", "medium", "high", "critical"] as const;
const MAX_EMAIL_LEN = 320;

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
      .select(
        "id, tenant_id, target_name, target_type, target_value, status, owner_email, business_criticality, created_at"
      )
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
      .select(
        "id, tenant_id, target_name, target_type, target_value, status, owner_email, business_criticality, created_at"
      )
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

type PatchScanTargetBody = {
  id?: unknown;
  tenantId?: unknown;
  ownerEmail?: unknown;
  businessCriticality?: unknown;
};

/**
 * Update optional asset metadata (owner email, business criticality) for a scan target.
 * Body: `id` (target UUID), `tenantId`, and at least one of `ownerEmail`, `businessCriticality`.
 * (Id in body avoids a dynamic route segment named `[id]`, which is awkward on some Windows toolchains.)
 */
export async function PATCH(request: Request) {
  return patchScanTargetMetadata(request);
}

export async function PUT(request: Request) {
  return patchScanTargetMetadata(request);
}

async function patchScanTargetMetadata(request: Request) {
  try {
    let body: PatchScanTargetBody;
    try {
      body = (await request.json()) as PatchScanTargetBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const targetId = typeof body.id === "string" ? body.id.trim() : "";
    if (!targetId || !isUuid(targetId)) {
      return NextResponse.json({ ok: false, error: "id must be a valid scan target UUID" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    if (body.ownerEmail === undefined && body.businessCriticality === undefined) {
      return NextResponse.json(
        { ok: false, error: "At least one of ownerEmail, businessCriticality is required" },
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

    const patch: Record<string, string | null> = {};

    if (body.ownerEmail !== undefined) {
      if (body.ownerEmail === null) {
        patch.owner_email = null;
      } else if (typeof body.ownerEmail === "string") {
        const v = body.ownerEmail.trim();
        if (v.length === 0) {
          patch.owner_email = null;
        } else if (v.length > MAX_EMAIL_LEN) {
          return NextResponse.json(
            { ok: false, error: `ownerEmail must be at most ${MAX_EMAIL_LEN} characters` },
            { status: 400 }
          );
        } else {
          patch.owner_email = v;
        }
      } else {
        return NextResponse.json({ ok: false, error: "ownerEmail must be a string or null" }, { status: 400 });
      }
    }

    if (body.businessCriticality !== undefined) {
      if (body.businessCriticality === null) {
        patch.business_criticality = null;
      } else if (typeof body.businessCriticality === "string") {
        const c = body.businessCriticality.trim().toLowerCase();
        if (c.length === 0) {
          patch.business_criticality = null;
        } else if (!CRITICALITY.includes(c as (typeof CRITICALITY)[number])) {
          return NextResponse.json(
            { ok: false, error: `businessCriticality must be one of: ${CRITICALITY.join(", ")}` },
            { status: 400 }
          );
        } else {
          patch.business_criticality = c;
        }
      } else {
        return NextResponse.json(
          { ok: false, error: "businessCriticality must be a string or null" },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("scan_targets")
      .update(patch)
      .eq("id", targetId)
      .eq("tenant_id", tenantId)
      .select(
        "id, tenant_id, target_name, target_type, target_value, status, owner_email, business_criticality, created_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Scan target not found for this tenant" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, scanTarget: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to update scan target", message },
      { status: 500 }
    );
  }
}
