import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { inngest } from "@/inngest/client";

const PRIVATE_DOMAIN_RE =
  /^(localhost|.*\.local|.*\.internal|.*\.test|.*\.example)(:\d+)?$|^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

function isPrivateDomain(domain: string): boolean {
  // Reject localhost, .local, .internal, .test, .example, and bare IPv4 addresses
  return PRIVATE_DOMAIN_RE.test(domain.toLowerCase().trim());
}

function normalizeDomain(raw: string): string {
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
    clientId,
    domain: rawDomain,
    companyName,
    knownEmails,
    runAgent1 = true,
    runAgent2 = true,
  } = body as {
    scanId?: string;
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

  const domain = normalizeDomain(rawDomain);

  if (!domain || domain.length < 3 || !domain.includes(".")) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  if (isPrivateDomain(domain)) {
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
      data: { scanId, clientId, domain },
    });
    triggered.push("agent1");
  }

  if (runAgent2) {
    events.push({
      name: "securewatch/agent2.osint_collection.requested" as const,
      data: { scanId, clientId, domain, companyName, knownEmails },
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
