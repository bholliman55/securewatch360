import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;
  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst", "viewer"] });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;

  const { data: asset, error } = await supabase
    .from("asset_inventory")
    .select(
      "id, asset_identifier, asset_name, asset_type, display_name, hostname, ip_address, mac_address, operating_system, owner, location, environment, criticality, status, finding_count, critical_count, high_count, last_seen_at, source, source_scan_id, source_scan_target_id, metadata, created_at, updated_at"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // Fetch linked scan target
  let scanTarget = null;
  if (asset.source_scan_target_id) {
    const { data } = await supabase
      .from("scan_targets")
      .select("id, target_name, target_type, target_value, status")
      .eq("id", asset.source_scan_target_id as string)
      .single();
    scanTarget = data;
  }

  // Fetch recent findings (up to 50)
  const { data: findings } = await supabase
    .from("findings")
    .select("id, severity, category, title, status, agent_type, created_at, scan_run_id")
    .eq("tenant_id", tenantId)
    .eq("asset_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch recent scan runs that touched this asset (via scan target)
  let scanRuns = null;
  if (asset.source_scan_target_id) {
    const { data } = await supabase
      .from("scan_runs")
      .select("id, scanner_name, scanner_type, status, created_at, completed_at")
      .eq("tenant_id", tenantId)
      .eq("scan_target_id", asset.source_scan_target_id as string)
      .order("created_at", { ascending: false })
      .limit(10);
    scanRuns = data;
  }

  return NextResponse.json({ asset, scanTarget, findings: findings ?? [], scanRuns: scanRuns ?? [] });
}
