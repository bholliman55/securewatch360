"use client";

import { Building2, AlertTriangle, Zap, Info, CheckCircle } from "lucide-react";
import { PostureRoadmapClient } from "@/app/posture-roadmap/PostureRoadmapClient";
import type {
  PostureCurrentState,
  PostureTargetState,
  GapItem,
  PostureRoadmapItem,
} from "@/types/posture-roadmap";
import { ROADMAP_CATEGORY_LABELS } from "@/types/posture-roadmap";

// ─── Demo tenant (seeded Acme Precision Manufacturing) ────────────────────────

const DEMO_TENANT_ID = "e0129f25-ab2c-4a0b-a72b-4cfaef9692b1";
const NOW = "2026-05-10T00:00:00Z";

// ─── Roadmap items (13) ───────────────────────────────────────────────────────

const DEMO_ROADMAP_ITEMS: PostureRoadmapItem[] = [
  // Identity & Access (3)
  {
    id: "demo-ri-001",
    tenant_id: DEMO_TENANT_ID,
    title: "Enforce MFA on All Privileged Accounts",
    category: "identity_access",
    related_framework: "CMMC_L2",
    current_state: "MFA enforced on fewer than 40% of privileged accounts. No Conditional Access policy.",
    desired_state: "100% of privileged accounts require MFA enforced via IdP Conditional Access.",
    priority: "critical",
    estimated_effort: "low",
    estimated_impact_score: 95,
    recommended_action:
      "Enable MFA in Azure AD / Okta for all admin and privileged roles. SecureWatch360 Identity Agent enforces and monitors continuously.",
    automation_level: "now",
    status: "not_started",
    sort_order: 1,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "demo-ri-002",
    tenant_id: DEMO_TENANT_ID,
    title: "Extend MFA to All Standard Users",
    category: "identity_access",
    related_framework: "CMMC_L2",
    current_state: "Standard users authenticate with passwords only. No MFA policy enforced.",
    desired_state: "All users require MFA. Exceptions require documented risk acceptance.",
    priority: "high",
    estimated_effort: "low",
    estimated_impact_score: 80,
    recommended_action:
      "Roll out MFA to all users via conditional access. Exclude break-glass accounts with monitoring alerts.",
    automation_level: "now",
    status: "not_started",
    sort_order: 2,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "demo-ri-003",
    tenant_id: DEMO_TENANT_ID,
    title: "Implement Least-Privilege Access Reviews",
    category: "identity_access",
    related_framework: "CMMC_L2",
    current_state: "No periodic access reviews. Over-provisioned accounts across shared drives and ERP.",
    desired_state: "Quarterly access reviews completed and documented. Role-based access enforced.",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 70,
    recommended_action:
      "Conduct quarterly access review using SecureWatch360 Identity Posture module. Remove stale and excess permissions.",
    automation_level: "later",
    status: "not_started",
    sort_order: 3,
    created_at: NOW,
    updated_at: NOW,
  },

  // Backup & Recovery (2)
  {
    id: "demo-ri-004",
    tenant_id: DEMO_TENANT_ID,
    title: "Configure Automated Backup Verification",
    category: "backup_recovery",
    related_framework: "CMMC_L2",
    current_state: "Backups run nightly but restoration untested in 14 months. No integrity verification.",
    desired_state: "Backups verified weekly via automated restore test. Results logged and reviewed monthly.",
    priority: "critical",
    estimated_effort: "low",
    estimated_impact_score: 90,
    recommended_action:
      "Enable backup integrity verification in backup solution. SecureWatch360 Backup Agent monitors and alerts on failures.",
    automation_level: "now",
    status: "not_started",
    sort_order: 4,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "demo-ri-005",
    tenant_id: DEMO_TENANT_ID,
    title: "Conduct Quarterly Backup Restoration Drills",
    category: "backup_recovery",
    related_framework: "CMMC_L2",
    current_state: "No documented restoration procedure. Last drill not on record.",
    desired_state: "Quarterly restoration drills with documented results and IT leadership sign-off.",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 75,
    recommended_action:
      "Schedule quarterly drills. Document RTO/RPO results. Upload evidence to SecureWatch360 compliance vault.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 5,
    created_at: NOW,
    updated_at: NOW,
  },

  // Endpoint Security (2)
  {
    id: "demo-ri-006",
    tenant_id: DEMO_TENANT_ID,
    title: "Deploy EDR to All Endpoints",
    category: "endpoint_security",
    related_framework: "CMMC_L2",
    current_state: "EDR deployed on 61% of endpoints. Manufacturing floor workstations and OT-adjacent hosts excluded.",
    desired_state: "100% endpoint EDR coverage including OT-adjacent hosts. Real-time alerts enabled.",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 88,
    recommended_action:
      "Deploy CrowdStrike / Defender for Endpoint to remaining hosts. SecureWatch360 Asset Discovery identifies coverage gaps.",
    automation_level: "now",
    status: "not_started",
    sort_order: 6,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "demo-ri-007",
    tenant_id: DEMO_TENANT_ID,
    title: "Enable Automated Patch Management",
    category: "endpoint_security",
    related_framework: "CMMC_L2",
    current_state: "Patching is manual and inconsistent. Average patch lag 47 days. 3 critical CVEs unpatched >90 days.",
    desired_state: "Critical patches applied within 14 days. High within 30. All tracked in SecureWatch360.",
    priority: "high",
    estimated_effort: "low",
    estimated_impact_score: 82,
    recommended_action:
      "Enable automated patching via WSUS/Intune. SecureWatch360 Patch Agent tracks SLA compliance and alerts on overdue items.",
    automation_level: "now",
    status: "not_started",
    sort_order: 7,
    created_at: NOW,
    updated_at: NOW,
  },

  // Vulnerability Management (1)
  {
    id: "demo-ri-008",
    tenant_id: DEMO_TENANT_ID,
    title: "Remediate Internet-Facing Vulnerabilities",
    category: "vulnerability_management",
    related_framework: "CMMC_L2",
    current_state: "12 internet-facing assets have critical/high CVEs. 3 are CISA KEV entries with no remediation plan.",
    desired_state: "Zero unpatched critical/high CVEs on internet-facing assets. CISA KEV items resolved within 72 hours.",
    priority: "critical",
    estimated_effort: "medium",
    estimated_impact_score: 92,
    recommended_action:
      "Prioritize CISA KEV items for immediate patching. SecureWatch360 Vulnerability Prioritization sequences remaining work by exploitability.",
    automation_level: "later",
    status: "not_started",
    sort_order: 8,
    created_at: NOW,
    updated_at: NOW,
  },

  // Monitoring & Logging (1)
  {
    id: "demo-ri-009",
    tenant_id: DEMO_TENANT_ID,
    title: "Enable SIEM and Centralized Log Aggregation",
    category: "monitoring_logging",
    related_framework: "CMMC_L2",
    current_state: "No centralized log aggregation. Logs siloed across 5 systems. No alerting on suspicious behavior.",
    desired_state: "All critical systems feed into SIEM. CMMC-relevant event alerting. 90-day log retention.",
    priority: "high",
    estimated_effort: "high",
    estimated_impact_score: 72,
    recommended_action:
      "Deploy Sentinel / Splunk. Configure SecureWatch360 Log Connector to normalize and forward events automatically.",
    automation_level: "later",
    status: "not_started",
    sort_order: 9,
    created_at: NOW,
    updated_at: NOW,
  },

  // Incident Response (2)
  {
    id: "demo-ri-010",
    tenant_id: DEMO_TENANT_ID,
    title: "Create and Document Incident Response Plan",
    category: "incident_response",
    related_framework: "CMMC_L2",
    current_state: "No formal IRP exists. Response is entirely ad hoc with no documented roles or escalation paths.",
    desired_state: "IRP documented, reviewed by leadership, and accessible to all response personnel.",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 68,
    recommended_action:
      "Use SecureWatch360 IRP template. Assign RACI. Store in compliance vault with version control.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 10,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "demo-ri-011",
    tenant_id: DEMO_TENANT_ID,
    title: "Conduct IRP Tabletop Exercise",
    category: "incident_response",
    related_framework: "CMMC_L2",
    current_state: "No tabletop exercise on record. Team unfamiliar with response procedures.",
    desired_state: "Annual tabletop completed with after-action report filed as CMMC evidence.",
    priority: "medium",
    estimated_effort: "low",
    estimated_impact_score: 55,
    recommended_action:
      "Schedule tabletop with IT, operations, and leadership. Use SecureWatch360 Scenario Library for CMMC-relevant scenarios.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 11,
    created_at: NOW,
    updated_at: NOW,
  },

  // Compliance Evidence (1)
  {
    id: "demo-ri-012",
    tenant_id: DEMO_TENANT_ID,
    title: "Build CMMC Evidence Repository",
    category: "compliance_evidence",
    related_framework: "CMMC_L2",
    current_state: "Evidence scattered across email, shared drives, and individual laptops. Not audit-ready.",
    desired_state: "Centralized evidence repository with automated collection for 62 CMMC controls. Audit-ready at all times.",
    priority: "critical",
    estimated_effort: "high",
    estimated_impact_score: 85,
    recommended_action:
      "Enable SecureWatch360 Evidence Vault. Configure auto-collection for identity, endpoint, and patch evidence.",
    automation_level: "later",
    status: "not_started",
    sort_order: 12,
    created_at: NOW,
    updated_at: NOW,
  },

  // Security Awareness (1)
  {
    id: "demo-ri-013",
    tenant_id: DEMO_TENANT_ID,
    title: "Complete Annual Security Awareness Training",
    category: "security_awareness",
    related_framework: "CMMC_L2",
    current_state: "Last org-wide training was 22 months ago. No phishing simulation program in place.",
    desired_state: "Annual training completed by all employees. Quarterly phishing simulations with <5% click rate.",
    priority: "high",
    estimated_effort: "medium",
    estimated_impact_score: 60,
    recommended_action:
      "Deploy KnowBe4 or Proofpoint training. Track completion in SecureWatch360. Run quarterly phishing simulations.",
    automation_level: "not_yet",
    status: "not_started",
    sort_order: 13,
    created_at: NOW,
    updated_at: NOW,
  },
];

// ─── Gap items (grouped by category) ─────────────────────────────────────────

function makeGap(
  category: PostureRoadmapItem["category"],
  gapCount: number,
  criticalCount: number,
  highCount: number
): GapItem {
  return {
    category,
    categoryLabel: ROADMAP_CATEGORY_LABELS[category],
    gapCount,
    criticalCount,
    highCount,
    items: DEMO_ROADMAP_ITEMS.filter((i) => i.category === category),
  };
}

const DEMO_GAPS: GapItem[] = [
  makeGap("identity_access",         3, 1, 2),
  makeGap("backup_recovery",         2, 1, 1),
  makeGap("endpoint_security",       2, 1, 1),
  makeGap("vulnerability_management",1, 1, 0),
  makeGap("monitoring_logging",      1, 0, 1),
  makeGap("incident_response",       2, 0, 1),
  makeGap("compliance_evidence",     1, 1, 0),
  makeGap("security_awareness",      1, 0, 1),
];

// ─── Current state ────────────────────────────────────────────────────────────

const DEMO_CURRENT_STATE: PostureCurrentState = {
  maturityScore: 42,
  maturityLabel: "Developing",
  isEstimated: false,
  frameworkReadiness: [
    {
      framework: "CMMC_L2",
      displayName: "CMMC Level 2",
      readinessPercent: 38,
      controlsPass: 42,
      controlsTotal: 110,
      requiredMaturityScore: 80,
      gapToRequired: 38,
    },
    {
      framework: "CMMC_L1",
      displayName: "CMMC Level 1",
      readinessPercent: 61,
      controlsPass: 37,
      controlsTotal: 61,
      requiredMaturityScore: 60,
      gapToRequired: 0,
    },
    {
      framework: "CIS",
      displayName: "CIS Controls v8",
      readinessPercent: 51,
      controlsPass: 55,
      controlsTotal: 107,
      requiredMaturityScore: 70,
      gapToRequired: 19,
    },
    {
      framework: "NIST",
      displayName: "NIST CSF 2.0",
      readinessPercent: 47,
      controlsPass: 89,
      controlsTotal: 190,
      requiredMaturityScore: 65,
      gapToRequired: 18,
    },
    {
      framework: "HIPAA",
      displayName: "HIPAA Security Rule",
      readinessPercent: 34,
      controlsPass: 20,
      controlsTotal: 59,
      requiredMaturityScore: 75,
      gapToRequired: 41,
    },
    {
      framework: "SOC2",
      displayName: "SOC 2 Type II",
      readinessPercent: 41,
      controlsPass: 47,
      controlsTotal: 114,
      requiredMaturityScore: 72,
      gapToRequired: 31,
    },
  ],
  topRisks: [
    {
      findingId: "demo-risk-001",
      title: "MFA not enforced on privileged accounts",
      severity: "critical",
      category: "identity_access",
      priorityScore: 98,
      status: "open",
      assetType: "Identity",
    },
    {
      findingId: "demo-risk-002",
      title: "Internet-facing RDP exposed — 3 CISA KEV entries unpatched",
      severity: "critical",
      category: "vulnerability_management",
      priorityScore: 96,
      status: "open",
      assetType: "Server",
    },
    {
      findingId: "demo-risk-003",
      title: "Backup integrity unverified for 14 months",
      severity: "critical",
      category: "backup_recovery",
      priorityScore: 91,
      status: "open",
      assetType: "Backup",
    },
    {
      findingId: "demo-risk-004",
      title: "EDR absent on 39% of endpoints including OT-adjacent hosts",
      severity: "high",
      category: "endpoint_security",
      priorityScore: 88,
      status: "open",
      assetType: "Endpoint",
    },
    {
      findingId: "demo-risk-005",
      title: "No centralized SIEM or audit log aggregation",
      severity: "high",
      category: "monitoring_logging",
      priorityScore: 75,
      status: "open",
      assetType: "Infrastructure",
    },
    {
      findingId: "demo-risk-006",
      title: "CMMC evidence scattered across email and shared drives — not audit-ready",
      severity: "high",
      category: "compliance_evidence",
      priorityScore: 72,
      status: "open",
      assetType: "Compliance",
    },
  ],
  missingControlsCount: 47,
  exposedAssetsCount: 12,
  unresolvedFindingsCount: 31,
  criticalFindingsCount: 8,
  highFindingsCount: 14,
  identityGapsCount: 6,
};

// ─── Target state (CMMC Level 2) ─────────────────────────────────────────────

const DEMO_TARGET_STATE: PostureTargetState = {
  targetFramework: "CMMC_L2",
  targetFrameworkDisplayName: "CMMC Level 2",
  requiredMaturityScore: 80,
  currentMaturityScore: 42,
  distanceToReadiness: 38,
  currentGapCount: 13,
  requiredControlCount: 110,
  metControlCount: 42,
  keyRequiredControls: [
    { controlCode: "AC.L2-3.1.1",  controlTitle: "Limit system access to authorized users and processes",        status: "gap" },
    { controlCode: "AC.L2-3.1.5",  controlTitle: "Employ the principle of least privilege",                      status: "gap" },
    { controlCode: "AU.L2-3.3.1",  controlTitle: "Create and retain system audit logs",                          status: "gap" },
    { controlCode: "CM.L2-3.4.1",  controlTitle: "Establish and maintain system configuration baselines",        status: "met" },
    { controlCode: "IA.L2-3.5.3",  controlTitle: "Use multifactor authentication for network access",            status: "gap" },
    { controlCode: "IR.L2-3.6.1",  controlTitle: "Establish an operational incident-handling capability",        status: "gap" },
    { controlCode: "MP.L2-3.8.9",  controlTitle: "Protect the confidentiality of CUI during transport",          status: "met" },
    { controlCode: "RA.L2-3.11.2", controlTitle: "Scan for vulnerabilities in organizational systems periodically", status: "met" },
    { controlCode: "RE.L2-3.8.9",  controlTitle: "Regularly perform and test data backups",                      status: "gap" },
    { controlCode: "SC.L2-3.13.1", controlTitle: "Monitor, control, and protect communications at boundaries",   status: "gap" },
    { controlCode: "SI.L2-3.14.1", controlTitle: "Identify and manage information system flaws in a timely manner", status: "met" },
    { controlCode: "CA.L2-3.12.1", controlTitle: "Periodically assess security controls",                        status: "gap" },
  ],
};

// ─── Inline components ────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div
      className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm"
      style={{
        background: "rgba(234,179,8,0.08)",
        border: "1px solid rgba(234,179,8,0.25)",
        borderLeft: "3px solid #eab308",
      }}
    >
      <Info size={15} className="text-yellow-400 shrink-0" />
      <p className="text-yellow-300 font-medium">
        Demo Mode: showing sample SecureWatch360 posture data.{" "}
        <span className="font-normal text-yellow-300/70">
          Acme Precision Manufacturing · CMMC Level 2 assessment · data is illustrative.
        </span>
      </p>
    </div>
  );
}

interface StoryCardProps {
  icon: React.ReactNode;
  iconBg: string;
  accentColor: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: { icon: React.ReactNode; text: string }[];
  stat?: { value: string; label: string; color: string };
}

function StoryCard({ icon, iconBg, accentColor, title, subtitle, body, bullets, stat }: StoryCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: "#1e293b",
        border: `1px solid ${accentColor}33`,
        borderTop: `3px solid ${accentColor}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div>
          <p className="font-bold text-slate-100 leading-tight">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {stat && (
          <div className="ml-auto text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">{body}</p>

      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
            <span className="mt-0.5 shrink-0">{b.icon}</span>
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvestorBrief() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
      {/* Card 1 — The Company */}
      <StoryCard
        icon={<Building2 size={20} className="text-white" />}
        iconBg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        accentColor="#667eea"
        title="Acme Precision Manufacturing"
        subtitle="Defense Contractor · Grand Prairie, TX"
        body="Manufactures precision CNC components for US Department of Defense supply chains under Controlled Unclassified Information (CUI) contracts."
        stat={{ value: "~180", label: "employees", color: "#a78bfa" }}
        bullets={[
          { icon: <CheckCircle size={11} className="text-violet-400" />, text: "DoD prime contractor and subcontractor" },
          { icon: <CheckCircle size={11} className="text-violet-400" />, text: "Handles CUI on manufacturing floor systems" },
          { icon: <CheckCircle size={11} className="text-violet-400" />, text: "Federal contracts require CMMC L2 by Q4 2026" },
        ]}
      />

      {/* Card 2 — The Gap */}
      <StoryCard
        icon={<AlertTriangle size={20} className="text-white" />}
        iconBg="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
        accentColor="#ef4444"
        title="38% CMMC L2 Ready"
        subtitle="62 points below the certification threshold"
        body="SecureWatch360 identified 13 control gaps across identity, endpoint, backup, monitoring, and evidence. Five are critical — each independently grounds for audit failure."
        stat={{ value: "38%", label: "vs 80% required", color: "#ef4444" }}
        bullets={[
          { icon: <AlertTriangle size={11} className="text-red-400" />, text: "MFA missing on majority of privileged accounts" },
          { icon: <AlertTriangle size={11} className="text-red-400" />, text: "Backups untested for 14 months" },
          { icon: <AlertTriangle size={11} className="text-orange-400" />, text: "39% of endpoints lack EDR — including OT hosts" },
          { icon: <AlertTriangle size={11} className="text-orange-400" />, text: "12 internet-facing assets with unpatched critical CVEs" },
          { icon: <AlertTriangle size={11} className="text-orange-400" />, text: "Compliance evidence not audit-ready" },
        ]}
      />

      {/* Card 3 — The Solution */}
      <StoryCard
        icon={<Zap size={20} className="text-white" />}
        iconBg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
        accentColor="#22c55e"
        title="SecureWatch360 Shows the Path"
        subtitle="From visibility to autonomous remediation"
        body="Every gap is mapped to a prioritized action with effort, impact, and automation level. Customers start with full visibility — then expand into automated enforcement as confidence grows."
        stat={{ value: "5", label: "automatable now", color: "#22c55e" }}
        bullets={[
          { icon: <Zap size={11} className="text-green-400" />, text: "MFA enforcement — automate immediately via Identity Agent" },
          { icon: <Zap size={11} className="text-green-400" />, text: "Backup verification — automated integrity checks, zero manual effort" },
          { icon: <Zap size={11} className="text-green-400" />, text: "EDR deployment & patch management — agent-driven" },
          { icon: <CheckCircle size={11} className="text-green-400" />, text: "Evidence collected automatically for 62 CMMC controls" },
          { icon: <CheckCircle size={11} className="text-green-400" />, text: "Roadmap re-scores in real time as gaps close" },
        ]}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPostureRoadmapPage() {
  const automationAvailableCount = DEMO_ROADMAP_ITEMS.filter(
    (i) => i.automation_level === "now"
  ).length;

  const criticalItems = DEMO_ROADMAP_ITEMS.filter(
    (i) => i.priority === "critical"
  ).length;

  return (
    <main style={{ maxWidth: "1100px" }}>
      <DemoBanner />
      <InvestorBrief />
      <PostureRoadmapClient
        tenantId={DEMO_TENANT_ID}
        currentState={DEMO_CURRENT_STATE}
        targetState={DEMO_TARGET_STATE}
        gaps={DEMO_GAPS}
        roadmapItems={DEMO_ROADMAP_ITEMS}
        initialTargetFramework="CMMC_L2"
        totalRoadmapItems={DEMO_ROADMAP_ITEMS.length}
        criticalItems={criticalItems}
        automationAvailableCount={automationAvailableCount}
        isDemo
      />
    </main>
  );
}
