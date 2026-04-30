import { getSupabaseAdminClient } from "@/lib/supabase";

export type IntegrationType = "jira" | "servicenow" | "slack";

export interface IntegrationConfig {
  id: string;
  tenant_id: string;
  integration_type: IntegrationType;
  config: Record<string, unknown>;
  enabled: boolean;
  last_sync_at: string | null;
}

export interface SyncResult {
  externalId: string;
  externalUrl?: string;
  success: boolean;
  error?: string;
}

export async function getIntegrationConfig(
  tenantId: string,
  type: IntegrationType
): Promise<IntegrationConfig | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("integration_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("integration_type", type)
    .eq("enabled", true)
    .single();
  return data as IntegrationConfig | null;
}

export async function syncRemediationToJira(
  tenantId: string,
  remediationActionId: string,
  title: string,
  description: string
): Promise<SyncResult> {
  const config = await getIntegrationConfig(tenantId, "jira");
  if (!config) return { externalId: "", success: false, error: "Jira not configured for this tenant" };

  const { baseUrl, projectKey, email, apiToken } = config.config as {
    baseUrl: string;
    projectKey: string;
    email: string;
    apiToken: string;
  };

  try {
    const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: `[SecureWatch360] ${title}`,
          description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] },
          issuetype: { name: "Task" },
        },
      }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { errorMessages?: string[] };
      throw new Error(err.errorMessages?.[0] ?? `Jira API error ${res.status}`);
    }

    const data = (await res.json()) as { id: string; key: string; self: string };

    // Persist sync record
    const supabase = getSupabaseAdminClient();
    await supabase.from("integration_sync_records").upsert({
      tenant_id: tenantId,
      integration_type: "jira",
      local_resource_type: "remediation_action",
      local_resource_id: remediationActionId,
      external_id: data.key,
      external_url: `${baseUrl}/browse/${data.key}`,
      sync_state: "open",
    }, { onConflict: "tenant_id,integration_type,local_resource_id" });

    return { externalId: data.key, externalUrl: `${baseUrl}/browse/${data.key}`, success: true };
  } catch (e) {
    return { externalId: "", success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncRemediationToServiceNow(
  tenantId: string,
  remediationActionId: string,
  title: string,
  description: string
): Promise<SyncResult> {
  const config = await getIntegrationConfig(tenantId, "servicenow");
  if (!config) return { externalId: "", success: false, error: "ServiceNow not configured for this tenant" };

  const { instanceUrl, username, password } = config.config as {
    instanceUrl: string;
    username: string;
    password: string;
  };

  try {
    const res = await fetch(`${instanceUrl}/api/now/table/incident`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        short_description: `[SecureWatch360] ${title}`,
        description,
        urgency: "2",
        impact: "2",
      }),
    });

    if (!res.ok) throw new Error(`ServiceNow API error ${res.status}`);

    const data = (await res.json()) as { result: { sys_id: string; number: string } };
    const ticketNumber = data.result.number;

    const supabase = getSupabaseAdminClient();
    await supabase.from("integration_sync_records").upsert({
      tenant_id: tenantId,
      integration_type: "servicenow",
      local_resource_type: "remediation_action",
      local_resource_id: remediationActionId,
      external_id: ticketNumber,
      external_url: `${instanceUrl}/nav_to.do?uri=incident.do?sysparm_query=number=${ticketNumber}`,
      sync_state: "open",
    }, { onConflict: "tenant_id,integration_type,local_resource_id" });

    return { externalId: ticketNumber, externalUrl: `${instanceUrl}/nav_to.do?uri=incident.do?sysparm_query=number=${ticketNumber}`, success: true };
  } catch (e) {
    return { externalId: "", success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
