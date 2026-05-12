import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const ALLOWED_TYPES = ["jira", "servicenow", "slack"] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { data } = await supabase
    .from("integration_configs")
    .select("id, integration_type, enabled, last_sync_at, created_at")
    .eq("tenant_id", tenantUser.tenant_id as string);

  return NextResponse.json({ integrations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id, role").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
  if (tenantUser.role !== "owner" && tenantUser.role !== "admin") {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  const body = (await req.json()) as { integrationType?: string; config?: Record<string, unknown>; enabled?: boolean };
  if (!body.integrationType || !ALLOWED_TYPES.includes(body.integrationType as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({ error: "Invalid integrationType" }, { status: 400 });
  }

  const { error } = await supabase
    .from("integration_configs")
    .upsert({
      tenant_id: tenantUser.tenant_id as string,
      integration_type: body.integrationType,
      config: body.config ?? {},
      enabled: body.enabled ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,integration_type" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
