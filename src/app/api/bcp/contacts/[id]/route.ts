import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bcp_contacts")
    .update(body as Record<string, unknown>)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, contact: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = new URL(req.url).searchParams.get("tenantId")?.trim() ?? "";
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin"] });
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("bcp_contacts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
