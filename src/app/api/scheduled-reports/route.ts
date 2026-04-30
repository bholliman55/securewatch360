import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const VALID_FRAMEWORKS = ["NIST", "HIPAA", "PCI-DSS", "ISO 27001", "SOC 2", "CMMC", "CIS", "GDPR", "FedRAMP", "CCPA", "COBIT"];
const VALID_FORMATS = ["html", "json"];
const VALID_CRONS = [
  "0 8 * * 1",     // Weekly Monday 8am
  "0 8 1 * *",     // Monthly 1st
  "0 8 * * *",     // Daily 8am
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const { data } = await supabase
    .from("scheduled_reports")
    .select("*")
    .eq("tenant_id", tenantUser.tenant_id as string)
    .order("created_at", { ascending: false });

  return NextResponse.json({ reports: data ?? [] });
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

  const body = (await req.json()) as {
    name?: string;
    framework?: string;
    format?: string;
    cronExpression?: string;
    recipients?: string[];
  };

  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!body.framework || !VALID_FRAMEWORKS.includes(body.framework)) {
    return NextResponse.json({ error: "invalid framework" }, { status: 400 });
  }
  const format = VALID_FORMATS.includes(body.format ?? "") ? body.format : "html";
  const cron = VALID_CRONS.includes(body.cronExpression ?? "") ? body.cronExpression : "0 8 * * 1";

  const { data, error } = await supabase
    .from("scheduled_reports")
    .insert({
      tenant_id: tenantUser.tenant_id as string,
      name: body.name.trim(),
      framework: body.framework,
      format,
      cron_expression: cron,
      recipients: body.recipients ?? [],
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
