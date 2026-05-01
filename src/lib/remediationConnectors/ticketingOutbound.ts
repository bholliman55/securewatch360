import { syncRemediationToJira, syncRemediationToServiceNow } from "@/lib/integrationHub";

/**
 * Optional push of a completed remediation into ITSM when the payload uses adapter `ticketing`.
 * Enable with `REMEDIATION_TICKETING_ON_EXECUTE=jira` or `servicenow`.
 *
 * Note: connectors create external tickets; guard with integration configs and operational review
 * to avoid duplicate issues if you also sync manually.
 */
export function ticketingOutboundEnabled(adapterKey: string | undefined): boolean {
  if (adapterKey !== "ticketing") return false;
  const mode = process.env.REMEDIATION_TICKETING_ON_EXECUTE?.trim().toLowerCase();
  return mode === "jira" || mode === "servicenow";
}

export async function pushTicketingAfterRemediationComplete(params: {
  tenantId: string;
  remediationActionId: string;
  title: string;
  description: string;
  adapterKey: string | undefined;
}): Promise<{ ok: boolean; detail: string }> {
  if (!ticketingOutboundEnabled(params.adapterKey)) {
    return { ok: true, detail: "skipped_not_configured" };
  }

  const mode = process.env.REMEDIATION_TICKETING_ON_EXECUTE?.trim().toLowerCase() ?? "";

  if (mode === "jira") {
    const result = await syncRemediationToJira(
      params.tenantId,
      params.remediationActionId,
      params.title,
      params.description
    );
    return result.success
      ? { ok: true, detail: `jira:${result.externalId}` }
      : { ok: false, detail: result.error ?? "jira_sync_failed" };
  }

  if (mode === "servicenow") {
    const result = await syncRemediationToServiceNow(
      params.tenantId,
      params.remediationActionId,
      params.title,
      params.description
    );
    return result.success
      ? { ok: true, detail: `servicenow:${result.externalId}` }
      : { ok: false, detail: result.error ?? "servicenow_sync_failed" };
  }

  return { ok: true, detail: "skipped_unknown_mode" };
}
