import { timingSafeEqual } from "node:crypto";

function parseTenantAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Optional machine auth for policy pack export routes (connector / automation).
 * When POLICY_PACK_EXPORT_TOKEN is unset, this always returns false (session auth only).
 */
export function authorizePolicyPackExportRequest(request: Request, tenantId: string): boolean {
  const configured = process.env.POLICY_PACK_EXPORT_TOKEN?.trim();
  if (!configured) {
    return false;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const presented = match?.[1]?.trim() ?? "";
  if (!presented || !safeEqualString(presented, configured)) {
    return false;
  }

  const allow = parseTenantAllowlist(process.env.POLICY_PACK_EXPORT_TENANT_IDS);
  if (allow.length === 0) {
    return false;
  }
  return allow.includes(tenantId);
}
