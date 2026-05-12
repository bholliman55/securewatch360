import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { inngest } from "@/inngest/client";

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

  const { data, error } = await supabase
    .from("remediation_actions")
    .select("id, playbook, finding_id")
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id as string)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ playbook: data.playbook ?? null, findingId: data.finding_id });
}

export async function POST(
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

  const { data, error } = await supabase
    .from("remediation_actions")
    .select("id, playbook, finding_id, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenantUser.tenant_id as string)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.playbook) return NextResponse.json({ message: "Playbook already exists", playbook: data.playbook });

  await inngest.send({
    name: "securewatch/remediation.playbook.requested",
    data: {
      remediationActionId: id,
      findingId: data.finding_id as string,
      tenantId: data.tenant_id as string,
    },
  });

  return NextResponse.json({ message: "Playbook generation queued", remediationActionId: id });
}
