/**
 * POST /api/seed/demo-data
 *
 * Seeds realistic demo findings, scan runs, incidents, and remediation actions
 * for the requesting tenant so the console has live data to display.
 *
 * Idempotent by scan_run marker: calling it again adds no duplicate scan runs
 * if a demo run already exists with scanner_name='demo-seed'.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

const FINDINGS = [
  { severity: "critical", title: "Remote Code Execution via Log4Shell (CVE-2021-44228)", category: "vulnerability", status: "open", description: "Apache Log4j JNDI injection allows unauthenticated RCE. Actively exploited in the wild." },
  { severity: "critical", title: "SQL Injection in login endpoint", category: "vulnerability", status: "open", description: "Unparameterized query on /api/auth/login allows full database exfiltration." },
  { severity: "high", title: "Exposed .env file containing database credentials", category: "exposure", status: "open", description: "Production .env file is publicly accessible at /.env, exposing DB_PASSWORD and SECRET_KEY." },
  { severity: "high", title: "SSL/TLS certificate expires in 7 days", category: "configuration", status: "open", description: "Certificate for api.example.com expires 2026-05-16. Automated renewal failed." },
  { severity: "high", title: "Admin panel accessible without MFA", category: "access_control", status: "open", description: "The /admin path enforces password auth only. MFA bypass via direct URL manipulation." },
  { severity: "high", title: "Outdated OpenSSL 1.0.2 (CVE-2022-0778)", category: "vulnerability", status: "open", description: "Infinite loop in BN_mod_sqrt() allows DoS by remote unauthenticated attacker." },
  { severity: "medium", title: "Missing security headers (CSP, HSTS)", category: "configuration", status: "open", description: "Content-Security-Policy and Strict-Transport-Security headers absent on primary domain." },
  { severity: "medium", title: "Default credentials on internal Grafana instance", category: "access_control", status: "open", description: "Grafana at monitoring.internal reachable from external VPN with admin:admin credentials." },
  { severity: "medium", title: "S3 bucket with public read ACL", category: "exposure", status: "open", description: "s3://company-assets-prod has public read ACL. Contains customer export files." },
  { severity: "medium", title: "Unpatched WordPress 6.2 (3 known CVEs)", category: "vulnerability", status: "open", description: "WordPress installation on blog subdomain missing security patches from Feb 2024." },
  { severity: "low", title: "HTTP TRACE method enabled", category: "configuration", status: "open", description: "TRACE method is enabled on web server, potentially aiding cross-site tracing attacks." },
  { severity: "low", title: "Verbose error messages in API responses", category: "information_disclosure", status: "open", description: "Stack traces and internal paths returned in 500 errors to external clients." },
];

const INCIDENT_TITLES = [
  "Critical RCE vulnerability under active exploitation",
  "Credential exposure incident — database credentials leaked",
  "Unauthorized access attempt on admin panel",
];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantId } = body as { tenantId?: string };
  if (!tenantId || !isUuid(tenantId)) {
    return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
  }

  const guard = await requireTenantAccess({ tenantId, allowedRoles: ["owner", "admin"] });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const supabase = getSupabaseAdminClient();

  // Check for existing demo seed scan run to keep this idempotent
  const { data: existingRuns } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("scanner_name", "demo-seed")
    .limit(1);

  if (existingRuns && existingRuns.length > 0) {
    return NextResponse.json({ ok: true, message: "Demo data already loaded for this tenant." });
  }

  // 1. Create a scan target
  const { data: targetData, error: targetErr } = await supabase
    .from("scan_targets")
    .insert({
      tenant_id: tenantId,
      target_name: "Demo Web Application",
      target_type: "webapp",
      target_value: "https://demo.example.com",
      status: "active",
    })
    .select("id")
    .single();

  if (targetErr || !targetData) {
    return NextResponse.json({ ok: false, error: "Failed to create scan target", detail: targetErr?.message }, { status: 500 });
  }

  const now = new Date();
  const startedAt = new Date(now.getTime() - 4 * 60 * 1000).toISOString();
  const completedAt = new Date(now.getTime() - 1 * 60 * 1000).toISOString();

  // 2. Create a demo scan run
  const scanRunId = randomUUID();
  const { error: runErr } = await supabase.from("scan_runs").insert({
    id: scanRunId,
    tenant_id: tenantId,
    scan_target_id: targetData.id,
    scanner_name: "demo-seed",
    status: "completed",
    started_at: startedAt,
    completed_at: completedAt,
    result_summary: {
      severity_counts: { critical: 2, high: 4, medium: 4, low: 2, info: 0 },
    },
  });

  if (runErr) {
    return NextResponse.json({ ok: false, error: "Failed to create scan run", detail: runErr.message }, { status: 500 });
  }

  // 3. Insert findings
  const findingRows = FINDINGS.map((f) => ({
    tenant_id: tenantId,
    scan_run_id: scanRunId,
    severity: f.severity,
    title: f.title,
    description: f.description,
    category: f.category,
    asset_type: "webapp",
    status: f.status,
    exposure: null,
  }));

  const { error: findingsErr } = await supabase.from("findings").insert(findingRows);
  if (findingsErr) {
    return NextResponse.json({ ok: false, error: "Failed to insert findings", detail: findingsErr.message }, { status: 500 });
  }

  // 4. Insert demo incidents
  const incidentRows = INCIDENT_TITLES.map((title, idx) => ({
    tenant_id: tenantId,
    title,
    description: `Demo incident ${idx + 1} — seeded for demonstration purposes.`,
    severity: idx === 0 ? "critical" : "high",
    status: idx === 2 ? "contained" : "open",
    detected_at: new Date(now.getTime() - (idx + 1) * 30 * 60 * 1000).toISOString(),
  }));

  await supabase.from("incidents").insert(incidentRows);

  return NextResponse.json({
    ok: true,
    message: `Demo data loaded: ${FINDINGS.length} findings, 1 scan run, ${INCIDENT_TITLES.length} incidents.`,
  });
}
