#!/usr/bin/env node
/**
 * Demo seed script: Acme Precision Manufacturing — CMMC L2 Posture Roadmap
 *
 * Usage:
 *   node scripts/seed-posture-roadmap-demo.mjs [--tenant <uuid>]
 *
 * If --tenant is omitted, the script looks for a tenant whose name contains
 * "Acme" or "demo" (case-insensitive). If none is found, it creates one named
 * "Acme Precision Manufacturing".
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 * Uses the service role key so it bypasses RLS — server/CI use only.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Environment ──────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ─── CLI argument ─────────────────────────────────────────────────────────────

function getCliTenantId() {
  const idx = process.argv.indexOf("--tenant");
  return idx !== -1 ? process.argv[idx + 1] : null;
}

// ─── Tenant resolution ────────────────────────────────────────────────────────

async function resolveTenantId() {
  const cliId = getCliTenantId();
  if (cliId) {
    console.log(`Using tenant from --tenant flag: ${cliId}`);
    return cliId;
  }

  // Search for an existing Acme / demo tenant
  const { data: existing, error } = await supabase
    .from("tenants")
    .select("id, name")
    .or("name.ilike.%acme%,name.ilike.%demo%")
    .limit(1)
    .single();

  if (!error && existing) {
    console.log(`Found existing tenant "${existing.name}" (${existing.id})`);
    return existing.id;
  }

  // Create new tenant
  const { data: created, error: createError } = await supabase
    .from("tenants")
    .insert({ name: "Acme Precision Manufacturing" })
    .select("id, name")
    .single();

  if (createError) {
    console.error("Failed to create tenant:", createError.message);
    process.exit(1);
  }

  console.log(`Created new tenant "${created.name}" (${created.id})`);
  return created.id;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const FRAMEWORK_SCORES = [
  { framework: "CMMC_L2",  readiness_percentage: 38, current_score: 42, target_score: 80, status: "gap" },
  { framework: "CMMC_L1",  readiness_percentage: 61, current_score: 42, target_score: 60, status: "approaching" },
  { framework: "CIS",      readiness_percentage: 51, current_score: 42, target_score: 70, status: "gap" },
  { framework: "NIST",     readiness_percentage: 47, current_score: 42, target_score: 65, status: "gap" },
  { framework: "HIPAA",    readiness_percentage: 34, current_score: 42, target_score: 75, status: "gap" },
  { framework: "SOC2",     readiness_percentage: 41, current_score: 42, target_score: 72, status: "gap" },
];

const POSTURE_GAPS = [
  {
    category: "identity_access",
    framework: "CMMC_L2",
    control_id: "AC.L2-3.1.1",
    control_name: "Authorized Access Control",
    current_state: "MFA enforced on fewer than 40% of privileged accounts. No Conditional Access policy in place.",
    desired_state: "100% of privileged accounts require MFA; enforced via IdP Conditional Access policy.",
    gap_description: "Privileged users can authenticate with password only, exposing the organization to credential-based attacks.",
    severity: "critical",
    evidence_source: "Active Directory audit / IdP MFA report",
  },
  {
    category: "incident_response",
    framework: "CMMC_L2",
    control_id: "IR.L2-3.6.1",
    control_name: "Incident Response Plan",
    current_state: "No formal, documented Incident Response Plan (IRP) exists. Response is entirely ad hoc.",
    desired_state: "IRP documented, staff trained, and tabletop exercise completed within the past 12 months.",
    gap_description: "Without a tested IRP, response time to breaches or ransomware will be significantly longer, increasing business impact.",
    severity: "high",
    evidence_source: "Policy inventory review",
  },
  {
    category: "backup_recovery",
    framework: "CMMC_L2",
    control_id: "CP.L2-3.8.9",
    control_name: "Data Backup Protection",
    current_state: "Backups exist but are stored in the same environment as production data. No immutability or offsite copies.",
    desired_state: "Backups are immutable, replicated offsite, and recovery is tested quarterly.",
    gap_description: "Ransomware or insider threats could destroy backup copies. Recoverability is unverified.",
    severity: "critical",
    evidence_source: "Backup configuration review",
  },
  {
    category: "vulnerability_management",
    framework: "CMMC_L2",
    control_id: "RA.L2-3.11.2",
    control_name: "Vulnerability Scan",
    current_state: "4 internet-facing systems have critical CVEs with CVSS ≥ 9.0 open for more than 14 days.",
    desired_state: "Critical vulnerabilities on internet-facing systems patched or mitigated within 7 days of discovery.",
    gap_description: "Internet-exposed critical vulnerabilities represent the highest external attack surface. Immediate remediation required.",
    severity: "critical",
    evidence_source: "Vulnerability scan — SecureWatch360",
  },
  {
    category: "endpoint_security",
    framework: "CIS",
    control_id: "CIS-4.1",
    control_name: "Endpoint Protection Coverage",
    current_state: "EDR agent deployed on 61% of endpoints. 18 remote laptops have no agent and are unmanaged.",
    desired_state: "EDR deployed and reporting on 100% of managed endpoints. Coverage verified weekly.",
    gap_description: "Unmanaged remote endpoints are a blind spot. Threat actors frequently target unprotected remote workers.",
    severity: "high",
    evidence_source: "MDM / EDR console inventory",
  },
  {
    category: "security_awareness",
    framework: "HIPAA",
    control_id: "164.308(a)(5)",
    control_name: "Security Awareness and Training",
    current_state: "No formal security awareness training program. Last all-hands security briefing was over 18 months ago.",
    desired_state: "Role-based training completed by 100% of staff annually. Phishing simulation active quarterly.",
    gap_description: "Employees are the most common entry point for phishing and social engineering attacks. No training increases risk significantly.",
    severity: "medium",
    evidence_source: "HR training records",
  },
  {
    category: "monitoring_logging",
    framework: "CMMC_L2",
    control_id: "AU.L2-3.3.1",
    control_name: "Audit Log Management",
    current_state: "Logs exist on individual systems but are not aggregated. No SIEM. Retention is inconsistent.",
    desired_state: "All security-relevant logs centralized in a SIEM with 90-day retention. Alerts configured for critical events.",
    gap_description: "Without centralized logging, threat detection and incident investigation are severely impaired.",
    severity: "high",
    evidence_source: "System log configuration review",
  },
  {
    category: "compliance_evidence",
    framework: "CMMC_L2",
    control_id: "CA.L2-3.12.4",
    control_name: "System Security Plan",
    current_state: "No formal evidence collection process. Audit artifacts are not systematically gathered or stored.",
    desired_state: "Evidence mapped to each CMMC L2 control. SSP documented. Evidence library maintained in SecureWatch360.",
    gap_description: "CMMC L2 assessors require documented evidence for all 110 practices. Absence of evidence leads to assessment failure.",
    severity: "high",
    evidence_source: "Policy and documentation review",
  },
  {
    category: "network_security",
    framework: "NIST",
    control_id: "PR.AC-5",
    control_name: "Network Integrity",
    current_state: "Firewall ruleset has not been reviewed or audited in over 12 months. Stale rules present.",
    desired_state: "Firewall rules reviewed quarterly. Unauthorized rules removed. Change management process documented.",
    gap_description: "Stale firewall rules accumulate over time, widening the attack surface without business justification.",
    severity: "medium",
    evidence_source: "Firewall configuration export",
  },
  {
    category: "identity_access",
    framework: "SOC2",
    control_id: "CC6.6",
    control_name: "Third-Party Access Review",
    current_state: "Vendor and third-party access is provisioned on request and never formally reviewed or revoked.",
    desired_state: "All vendor access reviewed quarterly. Inactive accounts revoked within 30 days. Access log maintained.",
    gap_description: "Third-party accounts with stale access are a significant insider-threat and supply-chain risk vector.",
    severity: "medium",
    evidence_source: "Vendor access log review",
  },
];

const ACTION_ITEMS = [
  // ── Fix First (critical) ──────────────────────────────────────────────────
  {
    title: "Enforce MFA for all privileged user accounts",
    category: "identity_access",
    framework: "CMMC_L2",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 93,
    current_state: "MFA enforced on <40% of privileged accounts",
    desired_state: "MFA enforced on 100% of privileged accounts via Conditional Access",
    recommended_action: "Enable Conditional Access policy in IdP. Block legacy auth. Enroll all admin accounts within 14 days.",
    automation_status: "available_now",
    securewatch_agent: "Identity & Access Agent",
    status: "not_started",
    sort_order: 1,
  },
  {
    title: "Patch or mitigate all internet-facing critical vulnerabilities",
    category: "vulnerability_management",
    framework: "CMMC_L2",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 91,
    current_state: "4 critical CVEs open on internet-facing systems for 14+ days",
    desired_state: "Zero critical CVEs on internet-facing systems older than 7 days",
    recommended_action: "Apply vendor patches immediately. Where patch unavailable, apply WAF rule or network-level mitigation.",
    automation_status: "available_now",
    securewatch_agent: "Vulnerability Remediation Agent",
    status: "in_progress",
    sort_order: 2,
  },
  {
    title: "Validate backup recoverability and enable immutable offsite copies",
    category: "backup_recovery",
    framework: "CMMC_L2",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 88,
    current_state: "Backups exist but are not immutable, not offsite, and untested",
    desired_state: "Immutable, offsite backups with quarterly recovery test and documented RTO/RPO",
    recommended_action: "Enable Object Lock on S3/Azure Blob. Configure cross-region replication. Schedule and document recovery test.",
    automation_status: "planned",
    securewatch_agent: "Backup & Recovery Agent",
    status: "not_started",
    sort_order: 3,
  },
  // ── Next 30 Days (high) ───────────────────────────────────────────────────
  {
    title: "Deploy EDR agent to all unmanaged remote endpoints",
    category: "endpoint_security",
    framework: "CIS",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 82,
    current_state: "18 remote laptops have no EDR coverage",
    desired_state: "EDR deployed and active on 100% of managed endpoints",
    recommended_action: "Identify unmanaged devices via MDM gap report. Push EDR agent via MDM policy. Alert on coverage < 95%.",
    automation_status: "available_now",
    securewatch_agent: "Endpoint Security Agent",
    status: "not_started",
    sort_order: 4,
  },
  {
    title: "Centralize security logs into a SIEM with 90-day retention",
    category: "monitoring_logging",
    framework: "CMMC_L2",
    priority: "high",
    estimated_effort: "high",
    estimated_impact_score: 84,
    current_state: "No centralized logging; logs siloed per system",
    desired_state: "All security logs flowing into SIEM; 90-day retention; critical alerts active",
    recommended_action: "Select SIEM (e.g., Microsoft Sentinel, Splunk). Configure log forwarders. Define initial alert ruleset.",
    automation_status: "planned",
    securewatch_agent: "Monitoring & Logging Agent",
    status: "not_started",
    sort_order: 5,
  },
  {
    title: "Document and test an Incident Response Plan",
    category: "incident_response",
    framework: "CMMC_L2",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 79,
    current_state: "No IRP exists; incident handling is entirely ad hoc",
    desired_state: "IRP documented, staff trained, tabletop exercise completed",
    recommended_action: "Use NIST SP 800-61 template. Define roles (IR Lead, Legal, PR). Schedule tabletop exercise.",
    automation_status: "manual_only",
    securewatch_agent: null,
    status: "not_started",
    sort_order: 6,
  },
  // ── Next 60 Days (medium) ─────────────────────────────────────────────────
  {
    title: "Build a CMMC L2 evidence library in SecureWatch360",
    category: "compliance_evidence",
    framework: "CMMC_L2",
    priority: "medium",
    estimated_effort: "high",
    estimated_impact_score: 87,
    current_state: "No structured evidence collection. Audit artifacts are scattered.",
    desired_state: "Evidence artifact mapped to each of the 110 CMMC L2 practices. Exportable for assessors.",
    recommended_action: "Use SecureWatch360 Evidence module. Map policies, screenshots, and scan exports to each control.",
    automation_status: "available_now",
    securewatch_agent: "Compliance Evidence Agent",
    status: "not_started",
    sort_order: 7,
  },
  {
    title: "Launch role-based security awareness training for all staff",
    category: "security_awareness",
    framework: "HIPAA",
    priority: "medium",
    estimated_effort: "medium",
    estimated_impact_score: 68,
    current_state: "No formal training. Last security briefing was 18+ months ago.",
    desired_state: "Role-based training completed by 100% of staff. Phishing simulation active.",
    recommended_action: "Select awareness platform (KnowBe4 or Proofpoint). Assign role-based modules. Run first phishing simulation.",
    automation_status: "planned",
    securewatch_agent: null,
    status: "not_started",
    sort_order: 8,
  },
  {
    title: "Audit and remediate stale firewall rules",
    category: "network_security",
    framework: "NIST",
    priority: "medium",
    estimated_effort: "medium",
    estimated_impact_score: 71,
    current_state: "Firewall ruleset not reviewed in 12+ months. Stale rules present.",
    desired_state: "Ruleset reviewed quarterly. Unauthorized rules removed. Change management documented.",
    recommended_action: "Export firewall ruleset. Flag rules with no recent hit count. Schedule quarterly review process.",
    automation_status: "manual_only",
    securewatch_agent: null,
    status: "not_started",
    sort_order: 9,
  },
  // ── Next 90 Days (low) ────────────────────────────────────────────────────
  {
    title: "Implement formal vendor and third-party access review process",
    category: "identity_access",
    framework: "SOC2",
    priority: "low",
    estimated_effort: "medium",
    estimated_impact_score: 63,
    current_state: "Vendor access never reviewed or revoked. No access log maintained.",
    desired_state: "Quarterly access review. Inactive accounts revoked within 30 days. Log maintained.",
    recommended_action: "Enumerate all vendor accounts. Define access review workflow. Assign access review owner.",
    automation_status: "planned",
    securewatch_agent: null,
    status: "not_started",
    sort_order: 10,
  },
  {
    title: "Deploy policy-as-code enforcement for all infrastructure changes",
    category: "compliance_evidence",
    framework: "CMMC_L2",
    priority: "low",
    estimated_effort: "high",
    estimated_impact_score: 72,
    current_state: "Infrastructure changes applied manually with no automated policy gate",
    desired_state: "OPA or Sentinel policy gates block non-compliant changes in CI/CD pipeline",
    recommended_action: "Implement OPA policies for Terraform. Gate all prod deployments through policy check. Export results to SecureWatch360.",
    automation_status: "available_now",
    securewatch_agent: "Policy Enforcement Agent",
    status: "not_started",
    sort_order: 11,
  },
  {
    title: "Enable continuous compliance monitoring across all frameworks",
    category: "monitoring_logging",
    framework: "NIST",
    priority: "low",
    estimated_effort: "medium",
    estimated_impact_score: 80,
    current_state: "Compliance posture measured manually and infrequently",
    desired_state: "SecureWatch360 monitors all control gaps continuously. Posture score updated on every scan.",
    recommended_action: "Configure SecureWatch360 compliance scan schedule. Enable drift alerting. Schedule weekly posture digest.",
    automation_status: "available_now",
    securewatch_agent: "Compliance Monitoring Agent",
    status: "not_started",
    sort_order: 12,
  },
  {
    title: "Enforce MFA and SSO for all standard user accounts",
    category: "identity_access",
    framework: "SOC2",
    priority: "low",
    estimated_effort: "medium",
    estimated_impact_score: 76,
    current_state: "MFA optional for non-privileged users; no SSO",
    desired_state: "MFA required for all users; SSO enabled for top 15 SaaS applications",
    recommended_action: "Expand Conditional Access policy to all users. Configure SSO integrations via IdP.",
    automation_status: "available_now",
    securewatch_agent: "Identity & Access Agent",
    status: "not_started",
    sort_order: 13,
  },
];

// automation_status → automation_level mapping for posture_roadmap_items
const AUTOMATION_LEVEL_MAP = {
  available_now: "now",
  planned: "later",
  manual_only: "not_yet",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  SecureWatch360 — Acme Precision Manufacturing Demo Seed");
  console.log("═══════════════════════════════════════════════════════════\n");

  const tenantId = await resolveTenantId();

  // ── 1. posture_target_config ───────────────────────────────────────────────
  console.log("Seeding posture_target_config …");
  const { error: targetErr } = await supabase
    .from("posture_target_config")
    .upsert(
      { tenant_id: tenantId, target_framework: "CMMC_L2", updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  if (targetErr) {
    console.error("  ✗ posture_target_config:", targetErr.message);
    process.exit(1);
  }
  console.log("  ✓ posture_target_config → CMMC_L2");

  // ── 2. posture_roadmap_items (original simpler table) ─────────────────────
  console.log("Seeding posture_roadmap_items …");
  const { error: deleteItemsErr } = await supabase
    .from("posture_roadmap_items")
    .delete()
    .eq("tenant_id", tenantId);
  if (deleteItemsErr) {
    console.error("  ✗ clear posture_roadmap_items:", deleteItemsErr.message);
    process.exit(1);
  }

  const roadmapItemsPayload = ACTION_ITEMS.map((item) => ({
    tenant_id: tenantId,
    title: item.title,
    category: item.category,
    related_framework: item.framework,
    current_state: item.current_state,
    desired_state: item.desired_state,
    priority: item.priority,
    estimated_effort: item.estimated_effort,
    estimated_impact_score: item.estimated_impact_score,
    recommended_action: item.recommended_action,
    automation_level: AUTOMATION_LEVEL_MAP[item.automation_status] ?? "not_yet",
    status: item.status,
    sort_order: item.sort_order,
  }));

  const { error: insertItemsErr } = await supabase
    .from("posture_roadmap_items")
    .insert(roadmapItemsPayload);
  if (insertItemsErr) {
    console.error("  ✗ insert posture_roadmap_items:", insertItemsErr.message);
    process.exit(1);
  }
  console.log(`  ✓ posture_roadmap_items → ${roadmapItemsPayload.length} rows`);

  // ── 3. posture_assessments ────────────────────────────────────────────────
  console.log("Seeding posture_assessments …");
  const { error: deleteAssessErr } = await supabase
    .from("posture_assessments")
    .delete()
    .eq("tenant_id", tenantId);
  if (deleteAssessErr) {
    console.error("  ✗ clear posture_assessments:", deleteAssessErr.message);
    process.exit(1);
  }

  const { data: assessment, error: insertAssessErr } = await supabase
    .from("posture_assessments")
    .insert({
      tenant_id: tenantId,
      assessment_name: "Acme Precision Manufacturing — CMMC L2 Readiness Assessment",
      overall_score: 42,
      maturity_level: "Developing",
      target_framework: "CMMC_L2",
      target_score: 80,
      readiness_percentage: 38,
      summary:
        "Acme Precision Manufacturing currently scores 42/100 overall (Developing maturity). " +
        "Critical gaps exist in identity enforcement, incident response, backup immutability, " +
        "and centralized logging. 13 prioritized roadmap items have been identified to reach " +
        "CMMC Level 2 readiness.",
    })
    .select("id")
    .single();

  if (insertAssessErr || !assessment) {
    console.error("  ✗ insert posture_assessments:", insertAssessErr?.message);
    process.exit(1);
  }
  const assessmentId = assessment.id;
  console.log(`  ✓ posture_assessments → id: ${assessmentId}`);

  // ── 4. framework_readiness_scores ─────────────────────────────────────────
  console.log("Seeding framework_readiness_scores …");
  const { error: frsErr } = await supabase
    .from("framework_readiness_scores")
    .insert(
      FRAMEWORK_SCORES.map((row) => ({ ...row, assessment_id: assessmentId }))
    );
  if (frsErr) {
    console.error("  ✗ framework_readiness_scores:", frsErr.message);
    process.exit(1);
  }
  console.log(`  ✓ framework_readiness_scores → ${FRAMEWORK_SCORES.length} rows`);

  // ── 5. posture_gaps ───────────────────────────────────────────────────────
  console.log("Seeding posture_gaps …");
  const { error: gapsErr } = await supabase
    .from("posture_gaps")
    .insert(
      POSTURE_GAPS.map((row) => ({ ...row, assessment_id: assessmentId }))
    );
  if (gapsErr) {
    console.error("  ✗ posture_gaps:", gapsErr.message);
    process.exit(1);
  }
  console.log(`  ✓ posture_gaps → ${POSTURE_GAPS.length} rows`);

  // ── 6. posture_roadmap_action_items ───────────────────────────────────────
  console.log("Seeding posture_roadmap_action_items …");
  const { error: actionErr } = await supabase
    .from("posture_roadmap_action_items")
    .insert(
      ACTION_ITEMS.map((item) => ({ ...item, assessment_id: assessmentId }))
    );
  if (actionErr) {
    console.error("  ✗ posture_roadmap_action_items:", actionErr.message);
    process.exit(1);
  }
  console.log(`  ✓ posture_roadmap_action_items → ${ACTION_ITEMS.length} rows`);

  // ── 7. posture_score_history ──────────────────────────────────────────────
  console.log("Seeding posture_score_history …");
  const { error: deleteHistErr } = await supabase
    .from("posture_score_history")
    .delete()
    .eq("tenant_id", tenantId);
  if (deleteHistErr) {
    console.error("  ✗ clear posture_score_history:", deleteHistErr.message);
    process.exit(1);
  }

  const { error: histErr } = await supabase.from("posture_score_history").insert({
    tenant_id: tenantId,
    assessment_id: assessmentId,
    overall_score: 42,
    cis_v8_score: 51,
    nist_csf_score: 47,
    cmmc_l1_score: 61,
    cmmc_l2_score: 38,
    hipaa_score: 34,
    soc2_score: 41,
    recorded_at: new Date().toISOString(),
  });
  if (histErr) {
    console.error("  ✗ posture_score_history:", histErr.message);
    process.exit(1);
  }
  console.log("  ✓ posture_score_history → 1 row");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  Demo seed complete — Acme Precision Manufacturing");
  console.log(`  Tenant ID     : ${tenantId}`);
  console.log(`  Assessment ID : ${assessmentId}`);
  console.log("  Tables seeded :");
  console.log("    posture_target_config          1 row (upserted)");
  console.log(`    posture_roadmap_items          ${roadmapItemsPayload.length} rows`);
  console.log("    posture_assessments            1 row");
  console.log(`    framework_readiness_scores     ${FRAMEWORK_SCORES.length} rows`);
  console.log(`    posture_gaps                   ${POSTURE_GAPS.length} rows`);
  console.log(`    posture_roadmap_action_items   ${ACTION_ITEMS.length} rows`);
  console.log("    posture_score_history          1 row");
  console.log("───────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
