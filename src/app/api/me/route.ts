import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

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
      tenants = (memberships ?? []).map((m) => ({
        id: m.tenant_id,
        name: nameById.get(m.tenant_id) ?? "Tenant",
        role: m.role as string,
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
