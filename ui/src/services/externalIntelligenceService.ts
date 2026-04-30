import { apiJson } from "../lib/apiFetch";

export type ExternalIntelligenceRequest = {
  tenantId: string;
  targetValue: string;
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

  return apiJson<{ success: boolean; scanId: string; triggered: string[] }>(
    "/api/security/external-intelligence/run",
    {
      method: "POST",
      body: JSON.stringify({
        tenantId: request.tenantId,
        domain,
        companyName: request.companyName,
        knownEmails: request.knownEmails ?? [],
        runAgent1: request.runAgent1 ?? true,
        runAgent2: request.runAgent2 ?? true,
      }),
    }
  );
}
