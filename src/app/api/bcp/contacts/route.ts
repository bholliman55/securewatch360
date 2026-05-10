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
    .from("bcp_contacts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("escalation_level", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const {
    name, title, role, email, phone, slack_handle,
    escalation_level, notify_on_severity, notify_on_category, active, notes,
  } = body as {
    name?: string; title?: string; role?: string; email?: string; phone?: string;
    slack_handle?: string; escalation_level?: number; notify_on_severity?: string[];
    notify_on_category?: string[]; active?: boolean; notes?: string;
  };

  if (!name || !role) {
    return NextResponse.json({ ok: false, error: "name and role are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bcp_contacts")
    .insert({
      tenant_id: tenantId, name, title: title ?? null, role,
      email: email ?? null, phone: phone ?? null, slack_handle: slack_handle ?? null,
      escalation_level: escalation_level ?? 1,
      notify_on_severity: notify_on_severity ?? ["critical", "high"],
      notify_on_category: notify_on_category ?? [],
      active: active !== false,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contact: data }, { status: 201 });
}
