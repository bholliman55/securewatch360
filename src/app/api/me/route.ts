import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getLocalDemoTenantId } from "@/lib/tenant-guard";

const LOCAL_DEMO_TENANTS = [
  { id: "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001", name: "Acme Regional Health", role: "owner" },
  { id: "4f7c3a10-2a7d-4b0e-9a64-6d55d7b3a102", name: "Northwind Dental Group", role: "admin" },
  { id: "91e8a6c2-1f50-4f65-8d1f-2588b057a103", name: "Summit Public Sector", role: "analyst" },
] as const;

async function ensureLocalDemoTenantsForUser(userId: string) {
  const demoTenantId = getLocalDemoTenantId();
  if (!demoTenantId) return [];

  const supabase = getSupabaseAdminClient();
  const demoTenants = LOCAL_DEMO_TENANTS.map((tenant, index) =>
    index === 0 ? { ...tenant, id: demoTenantId } : tenant
  );

  const { error: tenantsError } = await supabase
    .from("tenants")
    .upsert(
      demoTenants.map((tenant) => ({ id: tenant.id, name: tenant.name })),
      { onConflict: "id" }
    );

  if (tenantsError) {
    throw new Error(tenantsError.message);
  }

  const { error: membershipsError } = await supabase
    .from("tenant_users")
    .upsert(
      demoTenants.map((tenant) => ({
        tenant_id: tenant.id,
        user_id: userId,
        role: tenant.role,
      })),
      { onConflict: "tenant_id,user_id" }
    );

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  return demoTenants;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: true, user: null, tenants: [] }, { status: 200 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id);

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    const tenantIds = [...new Set((memberships ?? []).map((m) => m.tenant_id))];
    const localDemoTenants = await ensureLocalDemoTenantsForUser(user.id);
    for (const tenant of localDemoTenants) {
      if (!tenantIds.includes(tenant.id)) tenantIds.push(tenant.id);
    }

    let tenants: { id: string; name: string; role: string }[] = [];

    if (tenantIds.length > 0) {
      const { data: tenantRows, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name")
        .in("id", tenantIds);

      if (tenantsError) {
        throw new Error(tenantsError.message);
      }

      const nameById = new Map((tenantRows ?? []).map((t) => [t.id, t.name]));
      const roleById = new Map<string, string>();
      for (const membership of memberships ?? []) {
        roleById.set(membership.tenant_id, membership.role as string);
      }
      for (const tenant of localDemoTenants) {
        roleById.set(tenant.id, tenant.role);
      }

      tenants = tenantIds.map((tenantId) => ({
        id: tenantId,
        name: nameById.get(tenantId) ?? "Tenant",
        role: roleById.get(tenantId) ?? "viewer",
      }));
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email ?? "",
        },
        tenants,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: "Failed to load session", message }, { status: 500 });
  }
}
