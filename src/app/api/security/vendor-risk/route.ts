import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { inngest } from "@/inngest/client";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;

  const { data, error, count } = await supabase
    .from("vendor_assessments")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantUser.tenant_id as string)
    .order("last_assessed_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data, total: count, page });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vendorName, vendorDomain, clientId } = body as {
    vendorName?: string;
    vendorDomain?: string;
    clientId?: string;
  };

  if (!vendorName || typeof vendorName !== "string") {
    return NextResponse.json({ error: "vendorName is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const scanId = randomUUID();
  await inngest.send({
    name: "securewatch/vendor_risk.assessment.requested",
    data: { scanId, vendorName, vendorDomain, tenantId: tenantUser.tenant_id as string, clientId },
  });

  return NextResponse.json({ success: true, scanId, vendorName });
}
