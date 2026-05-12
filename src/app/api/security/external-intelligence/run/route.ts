import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { inngest } from "@/inngest/client";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { isBlockedExternalTarget, normalizeDomain } from "@/lib/externalTargetSafety";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { SCAN_RUN_STATUSES } from "@/lib/statuses";
import { getScanTypeRoute } from "@/lib/scanTypeRouting";

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
    scanType: rawScanType,
    companyName,
    knownEmails,
    runAgent1,
    runAgent2,
    agent2Mode,
  } = body as {
    scanId?: string;
    tenantId?: string;
    clientId?: string;
    domain?: string;
    scanType?: string;
    companyName?: string;
    knownEmails?: string[];
    runAgent1?: boolean;
    runAgent2?: boolean;
    agent2Mode?: string;
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
      { status: 400 },
    );
  }

  const scanId = rawScanId ?? randomUUID();
  const scanRoute = getScanTypeRoute(rawScanType ?? "external");
  const shouldRunAgent1 = typeof runAgent1 === "boolean" ? runAgent1 : scanRoute.runAgent1;
  const shouldRunAgent2 = typeof runAgent2 === "boolean" ? runAgent2 : scanRoute.runAgent2;
  const resolvedAgent2Mode =
    agent2Mode === "vulnerability_analysis" || scanRoute.agent2Mode === "vulnerability_analysis"
      ? "vulnerability_analysis"
      : "none";
  const triggered: string[] = [];
  const events = [];

  if (!shouldRunAgent1 && !shouldRunAgent2) {
    return NextResponse.json({ error: "At least one of runAgent1 or runAgent2 must be true" }, { status: 400 });
  }

  console.info("[external-intelligence/run] scan request received", {
    scan_id: scanId,
    scan_type: scanRoute.scanType,
    target: domain,
    client_id: clientId ?? null,
    tenant_id: tenantId.trim(),
    backend_route_called: "/api/security/external-intelligence/run",
  });

  // Create scan_run record immediately so the Scanner UI can show it as pending.
  const supabase = getSupabaseAdminClient();
  const agentLabel =
    shouldRunAgent1 && shouldRunAgent2
      ? "Agent 1+2: External Intelligence"
      : shouldRunAgent1
        ? "Agent 1: External Discovery"
        : "Agent 2: Vulnerability Analysis";
  const { error: runError } = await supabase.from("scan_runs").upsert(
    {
      id: scanId,
      tenant_id: tenantId.trim(),
      workflow_run_id: `ext-intel-${scanId}`,
      status: SCAN_RUN_STATUSES[0],
      scanner_name: agentLabel,
      scanner_type: shouldRunAgent2 && !shouldRunAgent1 ? "vulnerability" : "web",
      started_at: new Date().toISOString(),
      target_snapshot: {
        targetType: "domain",
        targetValue: domain,
        clientId: clientId ?? null,
        scanType: scanRoute.scanType,
        agent2Mode: resolvedAgent2Mode,
      },
    },
    { onConflict: "id" }
  );
  if (runError) {
    console.error("[external-intelligence/run] failed creating scan run", {
      scan_id: scanId,
      scan_type: scanRoute.scanType,
      target: domain,
      client_id: clientId ?? null,
      tenant_id: tenantId.trim(),
      backend_route_called: "/api/security/external-intelligence/run",
      response_status: 500,
      error_message: runError.message,
    });
    return NextResponse.json({ error: "Failed to create scan record", message: runError.message }, { status: 500 });
  }

  if (shouldRunAgent1) {
    events.push({
      name: "securewatch/agent1.external_discovery.requested" as const,
      data: { scanId, tenantId: tenantId.trim(), actorUserId: guard.userId, clientId, domain },
    });
    triggered.push("agent1");
  }

  if (shouldRunAgent2) {
    events.push({
      name: "securewatch/agent2.scan.requested" as const,
      data: {
        scanId,
        tenantId: tenantId.trim(),
        actorUserId: guard.userId,
        clientId,
        domain,
        target: domain,
        scanType: "vulnerability_analysis",
        companyName,
        knownEmails,
      },
    });
    triggered.push("agent2");
  }

  try {
    await inngest.send(events);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[external-intelligence/run] Inngest send failed", {
      scan_id: scanId,
      scan_type: scanRoute.scanType,
      target: domain,
      client_id: clientId ?? null,
      tenant_id: tenantId.trim(),
      backend_route_called: "/api/security/external-intelligence/run",
      response_status: 500,
      error_message: message,
    });
    return NextResponse.json({ error: "Failed to trigger intelligence scan" }, { status: 500 });
  }

  console.info("[external-intelligence/run] scan request accepted", {
    scan_id: scanId,
    scan_type: scanRoute.scanType,
    target: domain,
    client_id: clientId ?? null,
    tenant_id: tenantId.trim(),
    backend_route_called: "/api/security/external-intelligence/run",
    response_status: 200,
  });

  return NextResponse.json({
    success: true,
    scanId,
    scanType: scanRoute.scanType,
    triggered,
    message:
      shouldRunAgent2 && !shouldRunAgent1
        ? "Agent 2 vulnerability analysis scan queued."
        : "External scan queued.",
  });
}
