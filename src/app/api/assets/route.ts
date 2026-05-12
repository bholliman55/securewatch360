import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

// Only these scan target types represent technology assets that belong in the
// asset inventory.  URL, CIDR, webapp, and similar scanner inputs are scan
// targets only — they should NOT be promoted to assets automatically.
const ASSET_TARGET_TYPES = new Set([
  "ip",
  "hostname",
  "domain",
  "cloud_account",
]);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const tenantId = tenantUser.tenant_id as string;

  let query = supabase
    .from("asset_inventory")
    .select(
      "id, asset_identifier, asset_name, asset_type, display_name, hostname, ip_address, operating_system, owner, environment, criticality, status, finding_count, critical_count, high_count, last_seen_at, source, source_scan_target_id, metadata"
    )
    .eq("tenant_id", tenantId)
    .order("finding_count", { ascending: false })
    .limit(200);

  if (type) query = query.eq("asset_type", type);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate type counts
  const { data: typeCounts } = await supabase
    .from("asset_inventory")
    .select("asset_type")
    .eq("tenant_id", tenantId);

  const typeMap: Record<string, number> = {};
  for (const r of typeCounts ?? []) {
    const t = r.asset_type as string;
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  }

  return NextResponse.json({ assets: data ?? [], typeCounts: typeMap });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;
  const guard = await requireTenantAccess({
    tenantId,
    allowedRoles: [...API_TENANT_ROLES.mutate],
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  // Rebuild asset inventory from scan_targets.
  // Only scan targets whose type represents a real technology asset are
  // eligible.  URL, CIDR, webapp, repo, etc. are scanner inputs, not assets.
  const { data: targets } = await supabase
    .from("scan_targets")
    .select("id, target_name, target_type, target_value, status")
    .eq("tenant_id", tenantId)
    .in("target_type", Array.from(ASSET_TARGET_TYPES));

  if (!targets?.length) {
    return NextResponse.json({
      message: "No eligible scan targets to index as assets",
      count: 0,
    });
  }

  // For each eligible scan target, gather finding severity counts.
  const { data: findings } = await supabase
    .from("findings")
    .select("scan_target_id, severity")
    .eq("tenant_id", tenantId)
    .in("scan_target_id", targets.map((t) => t.id));

  const severityByTarget = new Map<string, { finding_count: number; critical_count: number; high_count: number; last_seen_at: string }>();
  for (const f of findings ?? []) {
    if (!f.scan_target_id) continue;
    const key = f.scan_target_id as string;
    const existing = severityByTarget.get(key);
    if (existing) {
      existing.finding_count++;
      if (f.severity === "critical") existing.critical_count++;
      if (f.severity === "high") existing.high_count++;
    } else {
      severityByTarget.set(key, {
        finding_count: 1,
        critical_count: f.severity === "critical" ? 1 : 0,
        high_count: f.severity === "high" ? 1 : 0,
        last_seen_at: new Date().toISOString(),
      });
    }
  }

  const rows = targets.map((t) => {
    const counts = severityByTarget.get(t.id) ?? {
      finding_count: 0,
      critical_count: 0,
      high_count: 0,
      last_seen_at: new Date().toISOString(),
    };
    return {
      tenant_id: tenantId,
      asset_identifier: t.target_value,
      asset_type: t.target_type,
      display_name: t.target_name,
      source: "scan",
      source_scan_target_id: t.id,
      finding_count: counts.finding_count,
      critical_count: counts.critical_count,
      high_count: counts.high_count,
      last_seen_at: counts.last_seen_at,
    };
  });

  const { error: upsertError } = await supabase
    .from("asset_inventory")
    .upsert(rows, { onConflict: "tenant_id,asset_identifier" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Asset inventory rebuilt from scan targets", count: rows.length });
}
