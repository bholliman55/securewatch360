import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { inngest } from "@/inngest/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { data } = await supabase
    .from("tenant_threat_digests")
    .select("digest, generated_at")
    .eq("tenant_id", tenantUser.tenant_id as string)
    .single();

  return NextResponse.json({ digest: data?.digest ?? null, generatedAt: data?.generated_at ?? null });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  await inngest.send({
    name: "securewatch/threat.digest.requested",
    data: { tenantId: tenantUser.tenant_id as string },
  });

  return NextResponse.json({ message: "Threat digest generation queued" });
}
