const SN_INSTANCE = process.env.SERVICENOW_INSTANCE?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
const SN_USER = process.env.SERVICENOW_USER?.trim() ?? "";
const SN_PASS = process.env.SERVICENOW_PASSWORD?.trim() ?? "";

function baseUrl(): string {
  if (!SN_INSTANCE) return "";
  if (SN_INSTANCE.startsWith("http")) return SN_INSTANCE;
  return `https://${SN_INSTANCE}`;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${SN_USER}:${SN_PASS}`).toString("base64")}`;
}

export function isServiceNowConfigured(): boolean {
  return Boolean(SN_INSTANCE && SN_USER && SN_PASS);
}

export type CreateServiceNowIncidentInput = {
  shortDescription: string;
  description?: string;
  urgency?: string;
  impact?: string;
};

export type ServiceNowCreateResult = {
  number: string;
  sysId: string;
  url: string;
};

/**
 * ServiceNow Table API: incident create.
 * Instance host only in SERVICENOW_INSTANCE (e.g. mycompany.service-now.com)
 */
export async function createServiceNowIncident(
  input: CreateServiceNowIncidentInput
): Promise<ServiceNowCreateResult> {
  if (!isServiceNowConfigured()) {
    throw new Error(
      "ServiceNow is not configured (SERVICENOW_INSTANCE, SERVICENOW_USER, SERVICENOW_PASSWORD)"
    );
  }
  const b = baseUrl();
  const url = `${b}/api/now/table/incident`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: authHeader(),
    },
    body: JSON.stringify({
      short_description: input.shortDescription,
      description: input.description ?? input.shortDescription,
      urgency: input.urgency ?? "2",
      impact: input.impact ?? "2",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    result?: { number?: string; sys_id?: string; task_number?: string };
  };

  if (!res.ok) {
    throw new Error(`ServiceNow create failed: ${res.status} ${JSON.stringify(data)}`);
  }
  const r = data.result;
  if (!r?.sys_id) {
    throw new Error("ServiceNow: missing result.sys_id");
  }
  return {
    number: r.number ?? r.task_number ?? "unknown",
    sysId: r.sys_id,
    url: `${b}/nav_to.do?uri=incident.do?sys_id=${r.sys_id}`,
  };
}
