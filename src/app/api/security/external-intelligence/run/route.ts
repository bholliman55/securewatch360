import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { inngest } from "@/inngest/client";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";

const PRIVATE_DOMAIN_RE = /^(localhost|.*\.local|.*\.internal|.*\.test|.*\.example)(:\d+)?$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isIpv4(host: string): boolean {
  return IPV4_RE.test(host.trim());
}

function isPrivateOrReservedIpv4(host: string): boolean {
  if (!isIpv4(host)) return false;
  const octets = host.split(".").map((n) => Number(n));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

export function isBlockedExternalTarget(host: string): boolean {
  const value = host.toLowerCase().trim();
  if (PRIVATE_DOMAIN_RE.test(value)) return true;
  if (isPrivateOrReservedIpv4(value)) return true;
  return false;
}

export function normalizeDomain(raw: string): string {
  try {
    // Accept bare domains or full URLs
    const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.toLowerCase().trim();
  } catch {
    return raw.toLowerCase().trim();
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    scanId: rawScanId,
    tenantId,
    clientId,
    domain: rawDomain,
    companyName,
    knownEmails,
    runAgent1 = true,
    runAgent2 = true,
  } = body as {
    scanId?: string;
    tenantId?: string;
    clientId?: string;
    domain?: string;
    companyName?: string;
    knownEmails?: string[];
    runAgent1?: boolean;
    runAgent2?: boolean;
  };

  if (!rawDomain || typeof rawDomain !== "string") {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const guard = await requireTenantAccess({
    tenantId: tenantId.trim(),
    allowedRoles: [...API_TENANT_ROLES.remediationAndScan],
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const domain = normalizeDomain(rawDomain);

  if (!domain || domain.length < 3 || !domain.includes(".")) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  if (isBlockedExternalTarget(domain)) {
    return NextResponse.json(
      { error: "Private/internal domains are not permitted as external intelligence targets" },
      { status: 400 }
    );
  }

  const scanId = rawScanId ?? randomUUID();
  const triggered: string[] = [];
  const events = [];

  if (runAgent1) {
    events.push({
      name: "securewatch/agent1.external_discovery.requested" as const,
      data: { scanId, tenantId: tenantId.trim(), actorUserId: guard.userId, clientId, domain },
    });
    triggered.push("agent1");
  }

  if (runAgent2) {
    events.push({
      name: "securewatch/agent2.osint_collection.requested" as const,
      data: {
        scanId,
        tenantId: tenantId.trim(),
        actorUserId: guard.userId,
        clientId,
        domain,
        companyName,
        knownEmails,
      },
    });
    triggered.push("agent2");
  }

  if (events.length === 0) {
    return NextResponse.json({ error: "At least one of runAgent1 or runAgent2 must be true" }, { status: 400 });
  }

  try {
    await inngest.send(events);
  } catch (err) {
    // Don't expose provider internals to the frontend
    console.error("[external-intelligence/run] Inngest send failed:", err);
    return NextResponse.json({ error: "Failed to trigger intelligence scan" }, { status: 500 });
  }

  return NextResponse.json({ success: true, scanId, triggered });
}
