import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const tenantId = tenantUser.tenant_id as string;

  let query = supabase
    .from("asset_inventory")
    .select("id, asset_identifier, asset_type, display_name, finding_count, critical_count, high_count, last_seen_at, metadata")
    .eq("tenant_id", tenantId)
    .order("finding_count", { ascending: false })
    .limit(200);

  if (type) query = query.eq("asset_type", type);

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

  // Rebuild inventory from findings
  const { data: findings } = await supabase
    .from("findings")
    .select("asset_type, id, severity, created_at")
    .eq("tenant_id", tenantId);

  if (!findings?.length) return NextResponse.json({ message: "No findings to index", count: 0 });

  const assetMap = new Map<string, { asset_type: string; finding_count: number; critical_count: number; high_count: number; last_seen_at: string }>();

  for (const f of findings) {
    const key = `${f.asset_type}`;
    const existing = assetMap.get(key);
    const isCritical = f.severity === "critical";
    const isHigh = f.severity === "high";
    if (existing) {
      existing.finding_count++;
      if (isCritical) existing.critical_count++;
      if (isHigh) existing.high_count++;
      if (f.created_at > existing.last_seen_at) existing.last_seen_at = f.created_at as string;
    } else {
      assetMap.set(key, {
        asset_type: f.asset_type as string,
        finding_count: 1,
        critical_count: isCritical ? 1 : 0,
        high_count: isHigh ? 1 : 0,
        last_seen_at: f.created_at as string,
      });
    }
  }

  const rows = Array.from(assetMap.entries()).map(([identifier, v]) => ({
    tenant_id: tenantId,
    asset_identifier: identifier,
    asset_type: v.asset_type,
    display_name: v.asset_type,
    finding_count: v.finding_count,
    critical_count: v.critical_count,
    high_count: v.high_count,
    last_seen_at: v.last_seen_at,
  }));

  await supabase.from("asset_inventory").upsert(rows, { onConflict: "tenant_id,asset_identifier" });

  return NextResponse.json({ message: "Asset inventory rebuilt", count: rows.length });
}
