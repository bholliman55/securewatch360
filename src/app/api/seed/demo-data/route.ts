import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function daysAgo(days: number): string {
  return nowIso(-days * 86_400_000);
}

function daysFromNow(days: number): string {
  return nowIso(days * 86_400_000);
}

function hoursAgo(hours: number): string {
  return nowIso(-hours * 3_600_000);
}

// Derive stable IDs scoped to a tenant for idempotency.
// Produces a valid v4-ish UUID string from tenant prefix + slot name.
function scopedId(tenantId: string, slot: string): string {
  const t = tenantId.replace(/-/g, "").padEnd(32, "0");
  const encoded = Array.from(slot)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .padEnd(24, "0")
    .slice(0, 24);
  // Build a UUID-shaped string: 8-4-4-4-12
  const raw = (t.slice(0, 16) + encoded).slice(0, 32).padEnd(32, "0");
  return [
    raw.slice(0, 8),
    raw.slice(8, 12),
    "4" + raw.slice(13, 16),
    raw.slice(16, 20),
    raw.slice(20, 32),
  ].join("-");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { tenantId?: string };
  const tenantId = body.tenantId?.trim();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  // Verify user is a member of this tenant
  const { data: membership } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ ok: false, error: "Not a member of this tenant" }, { status: 403 });
  }

  // Idempotency check — skip if already seeded
  const { data: existing } = await supabase
    .from("scan_targets")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("target_name", "Acme Corp Web App")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, message: "Demo data already loaded" });
  }

  // ── IDs ──────────────────────────────────────────────────────────────────
  const ids = {
    targetWeb: scopedId(tenantId, "target_web"),
    targetApi: scopedId(tenantId, "target_api"),
    targetCloud: scopedId(tenantId, "target_cloud"),
    run1: scopedId(tenantId, "run1"),
    run2: scopedId(tenantId, "run2"),
    run3: scopedId(tenantId, "run3"),
    f1: scopedId(tenantId, "finding_sql_inject"),
    f2: scopedId(tenantId, "finding_csp_miss"),
    f3: scopedId(tenantId, "finding_tls10"),
    f4: scopedId(tenantId, "finding_xpowered"),
    f5: scopedId(tenantId, "finding_cookie_flag"),
    f6: scopedId(tenantId, "finding_bola"),
    f7: scopedId(tenantId, "finding_jwt_none"),
    f8: scopedId(tenantId, "finding_s3_public"),
    r1: scopedId(tenantId, "remediation_sql"),
    r2: scopedId(tenantId, "remediation_bola"),
    r3: scopedId(tenantId, "remediation_s3"),
    a1: scopedId(tenantId, "approval_jwt_fix"),
  };

  // ── Scan Targets ─────────────────────────────────────────────────────────
  const { error: targetErr } = await supabase.from("scan_targets").upsert(
    [
      {
        id: ids.targetWeb,
        tenant_id: tenantId,
        target_name: "Acme Corp Web App",
        target_type: "url",
        target_value: "https://app.acmecorp.internal",
        status: "active",
        created_at: daysAgo(14),
      },
      {
        id: ids.targetApi,
        tenant_id: tenantId,
        target_name: "Payments API",
        target_type: "api",
        target_value: "https://api.payments.acmecorp.internal",
        status: "active",
        created_at: daysAgo(14),
      },
      {
        id: ids.targetCloud,
        tenant_id: tenantId,
        target_name: "AWS Production Account",
        target_type: "cloud_account",
        target_value: "aws:123456789012",
        status: "active",
        created_at: daysAgo(10),
      },
    ],
    { onConflict: "id" }
  );
  if (targetErr) {
    return NextResponse.json(
      { ok: false, error: `scan_targets: ${targetErr.message}` },
      { status: 500 }
    );
  }

  // ── Scan Runs ─────────────────────────────────────────────────────────────
  const { error: runErr } = await supabase.from("scan_runs").upsert(
    [
      {
        id: ids.run1,
        tenant_id: tenantId,
        scan_target_id: ids.targetWeb,
        workflow_run_id: `demo-run-web-${tenantId.slice(0, 8)}`,
        scanner_name: "mock-scanner",
        scanner_type: "web",
        status: "completed",
        started_at: daysAgo(7),
        completed_at: hoursAgo(167),
        created_at: daysAgo(7),
        result_summary: { findings_count: 5, scanner_version: "2.1.0" },
      },
      {
        id: ids.run2,
        tenant_id: tenantId,
        scan_target_id: ids.targetApi,
        workflow_run_id: `demo-run-api-${tenantId.slice(0, 8)}`,
        scanner_name: "mock-scanner",
        scanner_type: "api",
        status: "completed",
        started_at: daysAgo(3),
        completed_at: hoursAgo(71),
        created_at: daysAgo(3),
        result_summary: { findings_count: 2, scanner_version: "2.1.0" },
      },
      {
        id: ids.run3,
        tenant_id: tenantId,
        scan_target_id: ids.targetCloud,
        workflow_run_id: `demo-run-cloud-${tenantId.slice(0, 8)}`,
        scanner_name: "mock-scanner",
        scanner_type: "cloud",
        status: "completed",
        started_at: daysAgo(1),
        completed_at: hoursAgo(22),
        created_at: daysAgo(1),
        result_summary: { findings_count: 1, scanner_version: "2.1.0" },
      },
    ],
    { onConflict: "id" }
  );
  if (runErr) {
    return NextResponse.json(
      { ok: false, error: `scan_runs: ${runErr.message}` },
      { status: 500 }
    );
  }

  // ── Findings ──────────────────────────────────────────────────────────────
  const { error: findingErr } = await supabase.from("findings").upsert(
    [
      {
        id: ids.f1,
        tenant_id: tenantId,
        scan_run_id: ids.run1,
        severity: "critical",
        category: "injection",
        title: "SQL Injection in /api/search endpoint",
        description:
          "User-supplied input is concatenated directly into SQL queries without sanitization, allowing an attacker to extract or modify database records.",
        evidence: {
          cve: "CVE-2024-1234",
          cvss: 9.8,
          affected_url: "/api/search",
          request_sample: "GET /api/search?q=' OR '1'='1",
        },
        status: "open",
        asset_type: "webapp",
        exposure: "internet",
        priority_score: 95,
        compliance_impact: "critical",
        created_at: daysAgo(7),
      },
      {
        id: ids.f2,
        tenant_id: tenantId,
        scan_run_id: ids.run1,
        severity: "high",
        category: "configuration",
        title: "Missing Content-Security-Policy header",
        description:
          "The application does not set a Content-Security-Policy header, leaving it vulnerable to cross-site scripting (XSS) attacks.",
        evidence: { cwe: "CWE-693", affected_url: "/*", remediation: "Set a restrictive CSP header" },
        status: "open",
        asset_type: "webapp",
        exposure: "internet",
        priority_score: 72,
        compliance_impact: "high",
        created_at: daysAgo(7),
      },
      {
        id: ids.f3,
        tenant_id: tenantId,
        scan_run_id: ids.run1,
        severity: "medium",
        category: "cryptography",
        title: "Outdated TLS 1.0 protocol enabled",
        description:
          "The server supports TLS 1.0, which is deprecated and has known vulnerabilities including POODLE and BEAST attacks.",
        evidence: { cve: "CVE-2014-3566", affected_port: 443, protocols: ["TLSv1.0", "TLSv1.2", "TLSv1.3"] },
        status: "resolved",
        asset_type: "webapp",
        exposure: "internet",
        priority_score: 48,
        compliance_impact: "moderate",
        created_at: daysAgo(7),
      },
      {
        id: ids.f4,
        tenant_id: tenantId,
        scan_run_id: ids.run1,
        severity: "low",
        category: "information_disclosure",
        title: "Sensitive data in HTTP response headers",
        description:
          "The X-Powered-By header reveals the application framework version, enabling targeted exploitation.",
        evidence: { header: "X-Powered-By: Express 4.18.2", remediation: "Remove or obscure the header" },
        status: "open",
        asset_type: "webapp",
        exposure: "internet",
        priority_score: 25,
        compliance_impact: "low",
        created_at: daysAgo(7),
      },
      {
        id: ids.f5,
        tenant_id: tenantId,
        scan_run_id: ids.run1,
        severity: "high",
        category: "session_management",
        title: "Insecure cookie configuration (missing Secure flag)",
        description:
          "Session cookies are transmitted without the Secure flag, allowing them to be intercepted over plaintext HTTP connections.",
        evidence: { cwe: "CWE-614", cookie: "session", flags_missing: ["Secure", "SameSite"] },
        status: "open",
        asset_type: "webapp",
        exposure: "internet",
        priority_score: 68,
        compliance_impact: "high",
        created_at: daysAgo(7),
      },
      {
        id: ids.f6,
        tenant_id: tenantId,
        scan_run_id: ids.run2,
        severity: "critical",
        category: "access_control",
        title: "Broken Object Level Authorization in /api/v2/invoices/{id}",
        description:
          "API endpoint does not verify that the requesting user is authorized to access the requested invoice object, enabling IDOR attacks.",
        evidence: {
          cve: "CVE-2023-9876",
          endpoint: "/api/v2/invoices/:id",
          impact: "Any authenticated user can access any invoice",
        },
        status: "open",
        asset_type: "api",
        exposure: "internet",
        priority_score: 92,
        compliance_impact: "critical",
        created_at: daysAgo(3),
      },
      {
        id: ids.f7,
        tenant_id: tenantId,
        scan_run_id: ids.run2,
        severity: "critical",
        category: "authentication",
        title: "JWT algorithm confusion (none algorithm accepted)",
        description:
          "The API accepts JWTs signed with the 'none' algorithm, allowing unauthenticated requests to bypass authorization.",
        evidence: {
          cve: "CVE-2022-21449",
          endpoint: "/api/auth/verify",
          proof_of_concept: "alg: none header accepted",
        },
        status: "open",
        asset_type: "api",
        exposure: "internet",
        priority_score: 98,
        compliance_impact: "critical",
        created_at: daysAgo(3),
      },
      {
        id: ids.f8,
        tenant_id: tenantId,
        scan_run_id: ids.run3,
        severity: "critical",
        category: "cloud_misconfiguration",
        title: "S3 bucket publicly readable (acmecorp-backups)",
        description:
          "The S3 bucket 'acmecorp-backups' has a public ACL, allowing anyone on the internet to list and download its contents.",
        evidence: {
          resource: "s3://acmecorp-backups",
          region: "us-east-1",
          object_count: 847,
          exposed_size_gb: 12.4,
        },
        status: "open",
        asset_type: "cloud",
        exposure: "internet",
        priority_score: 99,
        compliance_impact: "critical",
        created_at: daysAgo(1),
      },
    ],
    { onConflict: "id" }
  );
  if (findingErr) {
    return NextResponse.json(
      { ok: false, error: `findings: ${findingErr.message}` },
      { status: 500 }
    );
  }

  // ── Remediation Actions ───────────────────────────────────────────────────
  const { error: remediationErr } = await supabase.from("remediation_actions").upsert(
    [
      {
        id: ids.r1,
        tenant_id: tenantId,
        finding_id: ids.f1,
        action_type: "manual_fix",
        action_status: "in_progress",
        notes:
          "Use parameterized queries or ORM methods. Never concatenate user input into SQL strings. Review all database-interacting endpoints.",
        execution_status: "running",
        execution_mode: "manual",
        created_at: daysAgo(6),
        updated_at: daysAgo(2),
      },
      {
        id: ids.r2,
        tenant_id: tenantId,
        finding_id: ids.f6,
        action_type: "ticket",
        action_status: "proposed",
        notes:
          "Add ownership validation to all /api/v2/invoices/* endpoints. Ensure user_id in JWT claims matches resource owner before returning data.",
        execution_status: "pending",
        execution_mode: "manual",
        created_at: daysAgo(2),
        updated_at: daysAgo(1),
      },
      {
        id: ids.r3,
        tenant_id: tenantId,
        finding_id: ids.f8,
        action_type: "config_change",
        action_status: "approved",
        notes:
          "Remove public ACL from S3 bucket acmecorp-backups. Enable S3 Block Public Access. Audit all bucket objects for accidental public exposure. Review IAM policies.",
        execution_status: "queued",
        execution_mode: "semi_automatic",
        created_at: daysAgo(1),
        updated_at: nowIso(),
      },
    ],
    { onConflict: "id" }
  );
  if (remediationErr) {
    return NextResponse.json(
      { ok: false, error: `remediation_actions: ${remediationErr.message}` },
      { status: 500 }
    );
  }

  // ── Approval Request ──────────────────────────────────────────────────────
  const { error: approvalErr } = await supabase.from("approval_requests").upsert(
    [
      {
        id: ids.a1,
        tenant_id: tenantId,
        finding_id: ids.f7,
        remediation_action_id: ids.r2,
        approval_type: "remediation_execution",
        status: "pending",
        reason:
          "Critical JWT vulnerability in Payments API requires immediate emergency patch. Requesting approval for off-cycle deployment to production. Impact: all authenticated sessions at risk.",
        request_payload: {
          urgency: "critical",
          affected_systems: ["payments-api"],
          estimated_downtime_minutes: 15,
          rollback_plan: "revert to previous Docker image tag",
        },
        response_payload: {},
        escalation_level: 1,
        sla_due_at: daysFromNow(1),
        created_at: daysAgo(2),
        updated_at: daysAgo(2),
      },
    ],
    { onConflict: "id" }
  );
  if (approvalErr) {
    return NextResponse.json(
      { ok: false, error: `approval_requests: ${approvalErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Demo data loaded successfully",
    seeded: {
      scanTargets: 3,
      scanRuns: 3,
      findings: 8,
      remediationActions: 3,
      approvalRequests: 1,
    },
  });
}
