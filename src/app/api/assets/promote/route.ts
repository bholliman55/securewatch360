import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

const VALID_ENVIRONMENTS = ["production", "staging", "development", "testing", "other"] as const;
const VALID_CRITICALITIES = ["critical", "high", "medium", "low"] as const;

const TARGET_TO_ASSET_TYPE: Record<string, string> = {
  ip: "ip", hostname: "hostname", domain: "domain", cloud_account: "cloud_account",
  url: "webapp", webapp: "webapp", cidr: "network", repo: "repository",
  container_image: "container", package_manifest: "package",
};

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

  const scanTargetId = typeof body.scanTargetId === "string" ? body.scanTargetId.trim() : null;
  if (!scanTargetId) return NextResponse.json({ error: "scanTargetId is required" }, { status: 400 });

  const { data: target } = await supabase
    .from("scan_targets")
    .select("id, target_name, target_type, target_value")
    .eq("id", scanTargetId)
    .eq("tenant_id", tenantId)
    .single();

  if (!target) return NextResponse.json({ error: "Scan target not found" }, { status: 404 });

  const assetType = TARGET_TO_ASSET_TYPE[target.target_type as string] ?? target.target_type;
  const rawEnv = typeof body.environment === "string" ? body.environment.trim() : null;
  const rawCrit = typeof body.criticality === "string" ? body.criticality.trim() : null;
  const targetType = target.target_type as string;

  const { data: asset, error } = await supabase
    .from("asset_inventory")
    .upsert(
      {
        tenant_id: tenantId,
        asset_identifier: target.target_value,
        asset_type: assetType,
        asset_name: typeof body.assetName === "string" && body.assetName.trim() ? body.assetName.trim() : null,
        display_name: target.target_name,
        hostname: ["hostname", "domain"].includes(targetType) ? (target.target_value as string) : null,
        ip_address: targetType === "ip" ? (target.target_value as string) : null,
        owner: typeof body.owner === "string" && body.owner.trim() ? body.owner.trim() : null,
        environment: VALID_ENVIRONMENTS.includes(rawEnv as never) ? rawEnv : null,
        criticality: VALID_CRITICALITIES.includes(rawCrit as never) ? rawCrit : null,
        internet_facing: body.internetFacing === true,
        source: "manual",
        source_scan_target_id: target.id,
        status: "active",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,asset_identifier" }
    )
    .select("id, asset_identifier, asset_type, asset_name, display_name, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ asset }, { status: 201 });
}
