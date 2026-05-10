#!/usr/bin/env node
/**
 * Seed script: posture roadmap items for demo/dev tenants.
 *
 * Usage:
 *   node scripts/seed-posture-roadmap.mjs <tenantId>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: node scripts/seed-posture-roadmap.mjs <tenantId>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/** @type {Array<Omit<import('../src/types/posture-roadmap.js').PostureRoadmapItem, 'id'|'created_at'|'updated_at'>>} */
const ROADMAP_SEED = [
  // ── Identity & Access ──────────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Enforce Multi-Factor Authentication (MFA) on all privileged accounts",
    category: "identity_access",
    related_framework: "CMMC_L2",
    current_state: "MFA enabled for <40% of admin accounts; no enforcement policy",
    desired_state: "MFA required for 100% of privileged accounts, enforced by policy",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 92,
    recommended_action: "Enable Conditional Access / MFA enforcement in IdP. Enroll all admin accounts within 30 days.",
    automation_level: "now",
    status: "not_started",
    sort_order: 1,
  },
  {
    tenant_id: tenantId,
    title: "Implement least-privilege access model with quarterly access reviews",
    category: "identity_access",
    related_framework: "CMMC_L2",
    current_state: "Ad-hoc role assignments; no formal access review process",
    desired_state: "All users assigned minimum required roles; quarterly review process documented and active",
    priority: "high",
    estimated_effort: "high",
    estimated_impact_score: 84,
    recommended_action: "Audit current role assignments. Create an access review workflow. Document and schedule quarterly reviews.",
    automation_level: "later",
    status: "not_started",
    sort_order: 2,
  },
  {
    tenant_id: tenantId,
    title: "Centralize identity management with SSO and directory sync",
    category: "identity_access",
    related_framework: "SOC2",
    current_state: "Multiple identity silos; manual provisioning/deprovisioning",
    desired_state: "SSO + SCIM provisioning active for all SaaS applications",
    priority: "medium",
    estimated_effort: "high",
    estimated_impact_score: 72,
    recommended_action: "Select an IdP (Okta, Entra ID). Enable SCIM for top 10 SaaS tools. Deprecate local accounts.",
    automation_level: "later",
    status: "not_started",
    sort_order: 3,
  },

  // ── Endpoint Security ──────────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Deploy EDR/XDR coverage to 100% of managed endpoints",
    category: "endpoint_security",
    related_framework: "CMMC_L2",
    current_state: "EDR deployed on ~60% of endpoints; no coverage tracking",
    desired_state: "EDR agent installed, active, and reporting on all managed devices",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 90,
    recommended_action: "Inventory all endpoints. Deploy EDR agent via MDM to unmanaged devices. Alert on coverage gaps > 5%.",
    automation_level: "now",
    status: "in_progress",
    sort_order: 4,
  },
  {
    tenant_id: tenantId,
    title: "Enforce disk encryption on all laptops and removable media",
    category: "endpoint_security",
    related_framework: "HIPAA",
    current_state: "BitLocker/FileVault enabled on ~50% of endpoints; no policy enforcement",
    desired_state: "Full-disk encryption required and verified on all portable endpoints",
    priority: "high",
    estimated_effort: "low",
    estimated_impact_score: 80,
    recommended_action: "Enable FileVault/BitLocker enforcement via MDM profile. Report on compliance weekly.",
    automation_level: "now",
    status: "not_started",
    sort_order: 5,
  },
  {
    tenant_id: tenantId,
    title: "Establish a mobile device management (MDM) baseline policy",
    category: "endpoint_security",
    related_framework: "CIS",
    current_state: "No formal MDM policy; BYOD devices unmanaged",
    desired_state: "MDM policy enforced for corporate and BYOD devices with minimum security baselines",
    priority: "medium",
    estimated_effort: "medium",
    estimated_impact_score: 68,
    recommended_action: "Define MDM baseline (screen lock, encryption, patch level). Enroll all corporate devices.",
    automation_level: "later",
    status: "not_started",
    sort_order: 6,
  },

  // ── Network Security ───────────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Segment network to isolate sensitive systems from general traffic",
    category: "network_security",
    related_framework: "NIST",
    current_state: "Flat network; production and dev share the same VLAN",
    desired_state: "Network segmented by zone (prod/dev/management/DMZ); inter-zone traffic firewalled",
    priority: "high",
    estimated_effort: "high",
    estimated_impact_score: 82,
    recommended_action: "Map current network topology. Define VLAN/zone schema. Implement firewall ACLs between zones.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 7,
  },
  {
    tenant_id: tenantId,
    title: "Remediate all internet-exposed services with no business justification",
    category: "network_security",
    related_framework: "CIS",
    current_state: "12 internet-exposed services identified; 4 have no documented business requirement",
    desired_state: "All internet-exposed services documented and justified; unauthorized exposures blocked",
    priority: "critical",
    estimated_effort: "low",
    estimated_impact_score: 88,
    recommended_action: "Review exposed services in scan findings. Close unauthorized ports. Document exceptions.",
    automation_level: "now",
    status: "not_started",
    sort_order: 8,
  },

  // ── Vulnerability Management ───────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Establish a formal patch management SLA (Critical: 7d, High: 30d)",
    category: "vulnerability_management",
    related_framework: "CMMC_L2",
    current_state: "No formal patch SLA; critical patches applied inconsistently",
    desired_state: "Documented SLA enforced: Critical ≤7 days, High ≤30 days, Medium ≤90 days",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 91,
    recommended_action: "Define SLA policy. Integrate with vulnerability scanner alerts. Track SLA breach in SecureWatch360.",
    automation_level: "now",
    status: "not_started",
    sort_order: 9,
  },
  {
    tenant_id: tenantId,
    title: "Run authenticated vulnerability scans on all assets monthly",
    category: "vulnerability_management",
    related_framework: "NIST",
    current_state: "Unauthenticated scans only; no scheduled scan cadence",
    desired_state: "Authenticated, credentialed scans running monthly on all in-scope assets",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 85,
    recommended_action: "Configure scan credentials in SecureWatch360. Schedule monthly scan for all asset groups.",
    automation_level: "now",
    status: "not_started",
    sort_order: 10,
  },

  // ── Backup & Recovery ──────────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Implement and test a documented backup and disaster recovery plan",
    category: "backup_recovery",
    related_framework: "HIPAA",
    current_state: "Backups exist but untested; no documented recovery procedure",
    desired_state: "Backup policy documented; recovery tested quarterly with RTO/RPO targets met",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 79,
    recommended_action: "Document backup schedule, retention, and recovery steps. Run tabletop exercise. Test restore monthly.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 11,
  },
  {
    tenant_id: tenantId,
    title: "Enforce offsite and immutable backup copies for critical data",
    category: "backup_recovery",
    related_framework: "SOC2",
    current_state: "Backups stored in same region/account as production data",
    desired_state: "Backups replicated to separate region; immutable copies retained for 30 days",
    priority: "medium",
    estimated_effort: "low",
    estimated_impact_score: 74,
    recommended_action: "Configure cross-region S3/GCS replication with Object Lock. Verify immutability policy.",
    automation_level: "later",
    status: "not_started",
    sort_order: 12,
  },

  // ── Monitoring & Logging ───────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Centralize security logs into a SIEM with 90-day retention",
    category: "monitoring_logging",
    related_framework: "CMMC_L2",
    current_state: "Logs dispersed across individual systems; no central aggregation",
    desired_state: "All security-relevant logs flowing to SIEM with ≥90-day retention and alerting",
    priority: "high",
    estimated_effort: "high",
    estimated_impact_score: 86,
    recommended_action: "Select SIEM. Configure log forwarding from cloud, endpoints, and network devices. Define alert rules.",
    automation_level: "later",
    status: "not_started",
    sort_order: 13,
  },
  {
    tenant_id: tenantId,
    title: "Enable audit logging for all privileged actions and data access",
    category: "monitoring_logging",
    related_framework: "SOC2",
    current_state: "Partial audit logging; privileged actions not consistently captured",
    desired_state: "All privileged actions, configuration changes, and data access events logged and retained",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 83,
    recommended_action: "Enable CloudTrail/Audit Logs on all cloud accounts. Enable DB audit log. Review with quarterly access audit.",
    automation_level: "now",
    status: "not_started",
    sort_order: 14,
  },

  // ── Compliance Evidence ────────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Build an evidence library for all CMMC L2 control requirements",
    category: "compliance_evidence",
    related_framework: "CMMC_L2",
    current_state: "Evidence collected ad-hoc; no structured evidence library",
    desired_state: "Evidence artifact mapped to each CMMC L2 control; exportable for assessors",
    priority: "high",
    estimated_effort: "high",
    estimated_impact_score: 88,
    recommended_action: "Use SecureWatch360 Evidence module. Map policies, screenshots, and scan reports to each control.",
    automation_level: "now",
    status: "not_started",
    sort_order: 15,
  },
  {
    tenant_id: tenantId,
    title: "Document and publish a System Security Plan (SSP)",
    category: "compliance_evidence",
    related_framework: "CMMC_L2",
    current_state: "No formal SSP exists",
    desired_state: "SSP documented, reviewed annually, and available to authorized stakeholders",
    priority: "medium",
    estimated_effort: "high",
    estimated_impact_score: 77,
    recommended_action: "Use NIST 800-171 SSP template. Document all CUI boundaries, system components, and control implementations.",
    automation_level: "later",
    status: "not_started",
    sort_order: 16,
  },

  // ── Security Awareness Training ────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Launch role-based security awareness training for all employees",
    category: "security_awareness",
    related_framework: "HIPAA",
    current_state: "No formal training program; annual all-hands security overview only",
    desired_state: "Role-based training launched; completion tracked; phishing simulation active",
    priority: "medium",
    estimated_effort: "medium",
    estimated_impact_score: 71,
    recommended_action: "Select awareness platform (KnowBe4, Proofpoint). Assign training by role. Track completion in SecureWatch360.",
    automation_level: "later",
    status: "not_started",
    sort_order: 17,
  },
  {
    tenant_id: tenantId,
    title: "Conduct quarterly phishing simulation campaigns",
    category: "security_awareness",
    related_framework: "NIST",
    current_state: "No phishing simulations conducted",
    desired_state: "Quarterly simulations with ≤5% click rate and immediate training for failures",
    priority: "medium",
    estimated_effort: "low",
    estimated_impact_score: 67,
    recommended_action: "Configure phishing simulation templates. Launch first campaign. Remediate failures with targeted training.",
    automation_level: "later",
    status: "not_started",
    sort_order: 18,
  },

  // ── Incident Response ──────────────────────────────────────────────────────
  {
    tenant_id: tenantId,
    title: "Document and rehearse an Incident Response Plan (IRP)",
    category: "incident_response",
    related_framework: "NIST",
    current_state: "No documented IRP; incident handling is informal",
    desired_state: "IRP documented, staff trained, and tabletop exercise completed annually",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 80,
    recommended_action: "Draft IRP using NIST SP 800-61 template. Define roles (IR lead, legal, PR). Conduct annual tabletop.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 19,
  },
  {
    tenant_id: tenantId,
    title: "Define and test breach notification procedures under HIPAA/applicable law",
    category: "incident_response",
    related_framework: "HIPAA",
    current_state: "No formal breach notification procedure documented",
    desired_state: "Breach notification runbook active; legal review complete; test completed",
    priority: "medium",
    estimated_effort: "medium",
    estimated_impact_score: 73,
    recommended_action: "Work with legal counsel to draft HIPAA breach notification SOP. Document timeline (60-day HHS notice). Test annually.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 20,
  },
];

async function main() {
  console.log(`Seeding posture roadmap for tenant: ${tenantId}`);

  // Upsert target config
  const { error: targetError } = await supabase
    .from("posture_target_config")
    .upsert(
      { tenant_id: tenantId, target_framework: "CMMC_L2", updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  if (targetError) {
    console.error("Failed to set target config:", targetError.message);
    process.exit(1);
  }
  console.log("  ✓ Target framework set to CMMC_L2");

  // Delete existing items for this tenant then re-insert
  const { error: deleteError } = await supabase
    .from("posture_roadmap_items")
    .delete()
    .eq("tenant_id", tenantId);
  if (deleteError) {
    console.error("Failed to clear existing items:", deleteError.message);
    process.exit(1);
  }

  const { error: insertError } = await supabase
    .from("posture_roadmap_items")
    .insert(ROADMAP_SEED);
  if (insertError) {
    console.error("Failed to insert roadmap items:", insertError.message);
    process.exit(1);
  }

  console.log(`  ✓ Inserted ${ROADMAP_SEED.length} roadmap items`);
  console.log("Posture roadmap seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
