import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

const ASSET_TARGET_TYPES = new Set(["ip", "hostname", "domain", "cloud_account"]);

export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;
  const guard = await requireTenantAccess({ tenantId, allowedRoles: [...API_TENANT_ROLES.mutate] });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data: targets } = await supabase
    .from("scan_targets")
    .select("id, target_name, target_type, target_value")
    .eq("tenant_id", tenantId)
    .in("target_type", Array.from(ASSET_TARGET_TYPES));

  if (!targets?.length) {
    return NextResponse.json({ message: "No eligible scan targets found", count: 0 });
  }

  const { data: findings } = await supabase
    .from("findings")
    .select("scan_target_id, severity")
    .eq("tenant_id", tenantId)
    .in("scan_target_id", targets.map((t) => t.id));

  const severityByTarget = new Map<string, { finding_count: number; critical_count: number; high_count: number }>();
  for (const f of findings ?? []) {
    if (!f.scan_target_id) continue;
    const key = f.scan_target_id as string;
    const s = severityByTarget.get(key) ?? { finding_count: 0, critical_count: 0, high_count: 0 };
    s.finding_count++;
    if (f.severity === "critical") s.critical_count++;
    if (f.severity === "high") s.high_count++;
    severityByTarget.set(key, s);
  }

  const rows = targets.map((t) => {
    const s = severityByTarget.get(t.id) ?? { finding_count: 0, critical_count: 0, high_count: 0 };
    return {
      tenant_id: tenantId,
      asset_identifier: t.target_value,
      asset_type: t.target_type,
      display_name: t.target_name,
      source: "scan",
      source_scan_target_id: t.id,
      ...s,
      last_seen_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("asset_inventory")
    .upsert(rows, { onConflict: "tenant_id,asset_identifier" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "Asset inventory rebuilt from scan targets", count: rows.length });
}
