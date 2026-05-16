import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

const VALID_ASSET_TYPES = [
  "ip", "hostname", "domain", "cloud_account",
  "server", "workstation", "laptop", "mobile", "network", "firewall",
  "webapp", "database", "container", "repository", "package", "iot", "other",
] as const;
const VALID_ENVIRONMENTS = ["production", "staging", "development", "testing", "other"] as const;
const VALID_CRITICALITIES = ["critical", "high", "medium", "low"] as const;
const VALID_STATUSES = ["active", "inactive", "decommissioned"] as const;

const SELECT_COLS =
  "id, asset_identifier, asset_name, asset_type, display_name, hostname, ip_address, operating_system, owner, environment, criticality, status, internet_facing, finding_count, critical_count, high_count, last_seen_at, source, source_scan_target_id, notes";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const tenantId = tenantUser.tenant_id as string;

  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const criticality = searchParams.get("criticality");
  const environment = searchParams.get("environment");
  const internetFacing = searchParams.get("internetFacing");
  const search = searchParams.get("search")?.trim();

  let query = supabase
    .from("asset_inventory")
    .select(SELECT_COLS)
    .eq("tenant_id", tenantId)
    .order("finding_count", { ascending: false })
    .limit(500);

  if (type) query = query.eq("asset_type", type);
  if (status) query = query.eq("status", status);
  if (criticality) query = query.eq("criticality", criticality);
  if (environment) query = query.eq("environment", environment);
  if (internetFacing === "true") query = query.eq("internet_facing", true);
  if (internetFacing === "false") query = query.eq("internet_facing", false);

  if (search) {
    // Supabase PostgREST full-text search across key fields
    const escaped = search.replace(/'/g, "''");
    query = query.or(
      `asset_name.ilike.%${escaped}%,hostname.ilike.%${escaped}%,ip_address.ilike.%${escaped}%,owner.ilike.%${escaped}%,asset_identifier.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Type counts (unfiltered, for filter-chip display)
  const { data: allRows } = await supabase
    .from("asset_inventory")
    .select("asset_type")
    .eq("tenant_id", tenantId);

  const typeMap: Record<string, number> = {};
  for (const r of allRows ?? []) {
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
  const guard = await requireTenantAccess({ tenantId, allowedRoles: [...API_TENANT_ROLES.mutate] });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Manual asset creation
  const assetIdentifier = typeof body.assetIdentifier === "string" ? body.assetIdentifier.trim() : null;
  if (!assetIdentifier) return NextResponse.json({ error: "assetIdentifier is required" }, { status: 400 });

  const assetType = typeof body.assetType === "string" ? body.assetType.trim() : null;
  if (!assetType || !VALID_ASSET_TYPES.includes(assetType as never)) {
    return NextResponse.json({ error: `assetType must be one of: ${VALID_ASSET_TYPES.join(", ")}` }, { status: 400 });
  }

  const rawEnv = typeof body.environment === "string" ? body.environment.trim() : null;
  const rawCrit = typeof body.criticality === "string" ? body.criticality.trim() : null;
  const rawStatus = typeof body.status === "string" ? body.status.trim() : "active";

  if (rawEnv && !VALID_ENVIRONMENTS.includes(rawEnv as never)) {
    return NextResponse.json({ error: `environment must be one of: ${VALID_ENVIRONMENTS.join(", ")}` }, { status: 400 });
  }
  if (rawCrit && !VALID_CRITICALITIES.includes(rawCrit as never)) {
    return NextResponse.json({ error: `criticality must be one of: ${VALID_CRITICALITIES.join(", ")}` }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(rawStatus as never)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const row = {
    tenant_id: tenantId,
    asset_identifier: assetIdentifier,
    asset_type: assetType,
    asset_name: typeof body.assetName === "string" && body.assetName.trim() ? body.assetName.trim() : null,
    display_name: typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : null,
    hostname: typeof body.hostname === "string" && body.hostname.trim() ? body.hostname.trim() : null,
    ip_address: typeof body.ipAddress === "string" && body.ipAddress.trim() ? body.ipAddress.trim() : null,
    operating_system: typeof body.operatingSystem === "string" && body.operatingSystem.trim() ? body.operatingSystem.trim() : null,
    owner: typeof body.owner === "string" && body.owner.trim() ? body.owner.trim() : null,
    environment: rawEnv || null,
    criticality: rawCrit || null,
    status: rawStatus,
    internet_facing: body.internetFacing === true,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    source: "manual",
    last_seen_at: new Date().toISOString(),
  };

  const { data: asset, error } = await supabase
    .from("asset_inventory")
    .upsert(row, { onConflict: "tenant_id,asset_identifier" })
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ asset }, { status: 201 });
}
