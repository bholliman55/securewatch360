import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { syncRemediationToJira, syncRemediationToServiceNow } from "@/lib/integrationHub";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    remediationActionId?: string;
    integration?: string;
    tenantId?: string;
  };

  if (!body.remediationActionId) return NextResponse.json({ error: "remediationActionId required" }, { status: 400 });
  if (!body.tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const guard = await requireTenantAccess({
    tenantId: body.tenantId,
    allowedRoles: [...API_TENANT_ROLES.mutate],
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const tenantId = body.tenantId;
  const supabase = getSupabaseAdminClient();

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
