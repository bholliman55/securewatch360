import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdminClient();

  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;

  // Verify incident belongs to tenant
  const { data: incident } = await supabase
    .from("incidents")
    .select("id, status, severity, title, created_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  // Pull audit log entries for this incident
  const { data: auditEntries } = await supabase
    .from("audit_logs")
    .select("id, action, actor_user_id, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "incident")
    .eq("resource_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ incident, timeline: auditEntries ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdminClient();

  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;
  const body = (await req.json()) as { note?: string };
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!note) return NextResponse.json({ error: "note required" }, { status: 400 });

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    action: "incident.note_added",
    actor_user_id: user.id,
    resource_type: "incident",
    resource_id: id,
    metadata: { note },
  });

  return NextResponse.json({ ok: true });
}
