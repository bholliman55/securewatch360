import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";

type OnboardingCompleteBody = {
  tenantName?: unknown;
};

/**
 * POST /api/onboarding/complete
 *
 * Provisions a brand-new tenant for the authenticated user and makes them
 * the owner. Safe to call multiple times — if the user already owns a tenant
 * it returns the existing one (idempotent by user_id + role = owner lookup).
 *
 * Returns: { ok: true, tenantId: string }
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: OnboardingCompleteBody = {};
    try {
      body = (await request.json()) as OnboardingCompleteBody;
    } catch {
      // body is optional — default tenant name falls back to user email
    }

    const tenantName =
      typeof body.tenantName === "string" && body.tenantName.trim().length > 0
        ? body.tenantName.trim()
        : (user.email ?? "My Organization");

    const supabase = getSupabaseAdminClient();

    // Idempotency: if the user already has an owner membership, return it.
    const { data: existing } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (existing?.tenant_id) {
      return NextResponse.json({ ok: true, tenantId: existing.tenant_id }, { status: 200 });
    }

    // Create the tenant row.
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({ name: tenantName })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { ok: false, error: "Failed to create tenant", message: tenantError?.message },
        { status: 500 }
      );
    }

    // Link the user as owner.
    const { error: memberError } = await supabase.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      // Roll back the orphaned tenant row so we don't leave dangling state.
      await supabase.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json(
        { ok: false, error: "Failed to create tenant membership", message: memberError.message },
        { status: 500 }
      );
    }

    await writeAuditLog({
      userId: user.id,
      tenantId: tenant.id,
      entityType: "system",
      entityId: tenant.id,
      action: "tenant.created",
      summary: `Tenant "${tenantName}" created via onboarding`,
      payload: { tenantName, source: "onboarding" },
    });

    return NextResponse.json({ ok: true, tenantId: tenant.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Onboarding failed", message },
      { status: 500 }
    );
  }
}
