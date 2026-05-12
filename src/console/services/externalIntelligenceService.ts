import { apiJson } from "../lib/apiFetch";
import { getScanTypeRoute, type ScanTypeValue } from "@/lib/scanTypeRouting";

export type ExternalIntelligenceRequest = {
  tenantId: string;
  targetValue: string;
  scanType?: ScanTypeValue;
  companyName?: string;
  knownEmails?: string[];
  runAgent1?: boolean;
  runAgent2?: boolean;
};

function isIpAddress(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value.trim());
}

export function normalizeExternalScanDomain(targetValue: string): string {
  const raw = targetValue.trim();
  if (!raw) return "";
  if (isIpAddress(raw)) return raw;

  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export async function triggerExternalIntelligenceScan(
  request: ExternalIntelligenceRequest
): Promise<{ success: boolean; scanId: string; triggered: string[] }> {
  const domain = normalizeExternalScanDomain(request.targetValue);
  if (!domain) {
    throw new Error("Provide a valid domain, URL, or IP target value.");
  }
  const route = getScanTypeRoute(request.scanType ?? "external");
  const runAgent1 = request.runAgent1 ?? route.runAgent1;
  const runAgent2 = request.runAgent2 ?? route.runAgent2;
  const backendRoute = route.backendRoute;

  console.info("[scanner-ui] launching scan", {
    scan_id: null,
    scan_type: route.scanType,
    target: domain,
    client_id: null,
    tenant_id: request.tenantId,
    backend_route_called: backendRoute,
  });

  const result = await apiJson<{ success: boolean; scanId: string; triggered: string[]; message?: string }>(
    backendRoute,
    {
      method: "POST",
      body: JSON.stringify({
        tenantId: request.tenantId,
        scanType: route.scanType,
        domain,
        companyName: request.companyName,
        knownEmails: request.knownEmails ?? [],
        runAgent1,
        runAgent2,
        agent2Mode: route.agent2Mode,
      }),
    }
  );

  console.info("[scanner-ui] scan launch completed", {
    scan_id: result.scanId,
    scan_type: route.scanType,
    target: domain,
    client_id: null,
    tenant_id: request.tenantId,
    backend_route_called: backendRoute,
    response_status: "success",
  });

  return result;
}
