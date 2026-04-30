import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { syncRemediationToJira, syncRemediationToServiceNow } from "@/lib/integrationHub";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const body = (await req.json()) as {
    remediationActionId?: string;
    integration?: string;
  };

  if (!body.remediationActionId) return NextResponse.json({ error: "remediationActionId required" }, { status: 400 });

  const tenantId = tenantUser.tenant_id as string;

  const { data: action } = await supabase
    .from("remediation_actions")
    .select("id, title, description")
    .eq("id", body.remediationActionId)
    .eq("tenant_id", tenantId)
    .single();

  if (!action) return NextResponse.json({ error: "Remediation action not found" }, { status: 404 });

  const title = String(action.title ?? "Remediation Action");
  const description = String(action.description ?? "Created by SecureWatch360");
  const integration = body.integration ?? "jira";

  let result;
  if (integration === "jira") {
    result = await syncRemediationToJira(tenantId, body.remediationActionId, title, description);
  } else if (integration === "servicenow") {
    result = await syncRemediationToServiceNow(tenantId, body.remediationActionId, title, description);
  } else {
    return NextResponse.json({ error: "Unsupported integration type" }, { status: 400 });
  }

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
