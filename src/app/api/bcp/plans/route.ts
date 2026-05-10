import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

export async function GET(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin", "analyst", "viewer"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("incident_response_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, plans: data ?? [] });
}

export async function POST(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const {
    name, description, incident_category, min_severity,
    procedures, auto_notify, auto_create_actions, active,
  } = body as {
    name?: string; description?: string; incident_category?: string; min_severity?: string;
    procedures?: unknown[]; auto_notify?: boolean; auto_create_actions?: boolean; active?: boolean;
  };

  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("incident_response_plans")
    .insert({
      tenant_id: tenantId,
      name,
      description: description ?? null,
      incident_category: incident_category ?? null,
      min_severity: min_severity ?? "high",
      procedures: procedures ?? [],
      auto_notify: auto_notify !== false,
      auto_create_actions: auto_create_actions === true,
      active: active !== false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, plan: data }, { status: 201 });
}
