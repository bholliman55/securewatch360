import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;
  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst", "viewer"] });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data: assets, error } = await supabase
    .from("asset_inventory")
    .select("criticality, internet_facing, finding_count, status, last_seen_at")
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = assets ?? [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const summary = {
    total_assets: rows.length,
    critical_assets: rows.filter((a) => a.criticality === "critical").length,
    internet_facing_assets: rows.filter((a) => a.internet_facing).length,
    unscanned_assets: rows.filter((a) => !a.last_seen_at || a.last_seen_at < thirtyDaysAgo).length,
    assets_with_findings: rows.filter((a) => (a.finding_count ?? 0) > 0).length,
  };

  return NextResponse.json(summary);
}
