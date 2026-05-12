"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Eye, UserCheck, X, ChevronDown, ChevronUp,
  Bot, Check, RotateCcw, Activity, Shield,
  ArrowLeft, Send, AlertTriangle, ClipboardList,
} from "lucide-react";
import type { PostureRoadmapItem } from "@/types/posture-roadmap";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionMode =
  | "recommend_only"
  | "assisted_remediation"
  | "autonomous_remediation";

export interface AutomationModalProps {
  item: PostureRoadmapItem | null;
  onClose: () => void;
  onRequestApproval: (item: PostureRoadmapItem, mode: ExecutionMode) => void;
}

type ModalView = "default" | "preview" | "submitted";

interface ExecutionStep {
  number: number;
  title: string;
  description: string;
  dryRunSafe: boolean; // true = no side effects; always runs even in dry-run
}

interface MockExecutionPlan {
  agent: string;
  modeLabel: string;
  estimatedDuration: string;
  blastRadius: "Low" | "Medium" | "High";
  steps: ExecutionStep[];
  affectedSystems: string[];
  validationChecks: string[];
  rollbackPlan: string;
}

// ─── Static mappings ──────────────────────────────────────────────────────────

const CATEGORY_TO_AGENT: Record<string, string> = {
  identity_access:       "Identity & Access Agent",
  endpoint_security:     "Endpoint Security Agent",
  vulnerability_management: "Vulnerability Remediation Agent",
  network_security:      "Network Security Agent",
  backup_recovery:       "Backup & Recovery Agent",
  monitoring_logging:    "Monitoring & Logging Agent",
  compliance_evidence:   "Compliance Evidence Agent",
  security_awareness:    "Security Awareness Agent",
  incident_response:     "Incident Response Agent",
};

const CATEGORY_TO_PERMISSIONS: Record<string, string[]> = {
  identity_access:       ["IdP Admin", "Conditional Access Write", "User Read"],
  endpoint_security:     ["MDM Admin", "EDR Console Write", "Asset Inventory Read"],
  vulnerability_management: ["Scanner Read", "ITSM Write", "Patch Management Write"],
  network_security:      ["Firewall Read", "Network Config Write"],
  backup_recovery:       ["Storage Admin", "Replication Config Write"],
  monitoring_logging:    ["SIEM Admin", "Log Source Config Write"],
  compliance_evidence:   ["Evidence Write", "Document Repository Read"],
  security_awareness:    ["Training Platform Admin", "HR System Read"],
  incident_response:     ["IRP Document Write", "Stakeholder Notify"],
};

const EFFORT_TO_DURATION: Record<string, string> = {
  low:    "15–30 min",
  medium: "1–4 hours",
  high:   "4–24 hours",
};

const PRIORITY_TO_RISK: Record<string, { label: string; color: string }> = {
  critical: { label: "High Risk",     color: "#ef4444" },
  high:     { label: "Medium Risk",   color: "#f97316" },
  medium:   { label: "Low Risk",      color: "#eab308" },
  low:      { label: "Minimal Risk",  color: "#22c55e" },
};

const MODE_META: Record<ExecutionMode, {
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  recommend_only: {
    label: "Recommend Only",
    description: "Show what would be done. No changes made to your environment.",
    Icon: Eye,
  },
  assisted_remediation: {
    label: "Assisted Remediation",
    description: "Agent prepares each action step. You review and approve before anything executes.",
    Icon: UserCheck,
  },
  autonomous_remediation: {
    label: "Autonomous Remediation",
    description: "Agent executes the full plan automatically. Requires admin pre-approval.",
    Icon: Zap,
  },
};

// ─── Plan generator ───────────────────────────────────────────────────────────

function generateMockExecutionPlan(
  item: PostureRoadmapItem,
  mode: ExecutionMode
): MockExecutionPlan {
  const agent = CATEGORY_TO_AGENT[item.category] ?? "SecureWatch360 Agent";
  const modeLabel = MODE_META[mode].label;
  const estimatedDuration = EFFORT_TO_DURATION[item.estimated_effort] ?? "1–4 hours";

  let steps: ExecutionStep[];
  let affectedSystems: string[];
  let validationChecks: string[];
  let rollbackPlan: string;
  let blastRadius: "Low" | "Medium" | "High";

  switch (item.category) {
    case "identity_access":
      blastRadius = "Medium";
      steps = [
        {
          number: 1,
          title: "Identify privileged users without MFA",
          description: "Query IdP for all accounts with admin, privileged, or elevated roles. Cross-reference MFA enrollment records to produce the gap list.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Generate enforcement policy",
          description: "Build a Conditional Access policy targeting identified accounts. Preview policy scope and projected impact before any changes are made.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Notify affected users",
          description: "Dispatch automated enrollment prompts to affected users via email and SecureWatch360 in-app notification with a setup deadline.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Apply MFA requirement",
          description: "Push the Conditional Access policy to the IdP. Policy activates on each user's next sign-in attempt.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Validate sign-in policy",
          description: "Confirm the policy is active across all targeted accounts. Test with a canary account. Review sign-in event logs for unexpected lockouts.",
          dryRunSafe: false,
        },
        {
          number: 6,
          title: "Write audit record",
          description: "Create a signed audit event in SecureWatch360 recording accounts affected, policy ID applied, agent identity, and timestamp.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["Azure Active Directory / Entra ID", "IdP MFA Service", "Conditional Access Engine"];
      validationChecks = [
        "MFA enforcement active on all privileged accounts",
        "Enrollment rate ≥ 95% within 48 hours",
        "No admin lockouts detected",
        "Sign-in logs show no anomalies post-enforcement",
      ];
      rollbackPlan =
        "Disable the new Conditional Access policy and restore the previous conditional access state. Notify affected users that MFA enforcement has been paused. Document rollback reason and timestamp in SecureWatch360 audit log.";
      break;

    case "vulnerability_management":
      blastRadius = "High";
      steps = [
        {
          number: 1,
          title: "Pull current vulnerability scan results",
          description: "Fetch latest scan data from the vulnerability scanner, filtered to internet-facing assets with CVSS ≥ 7.0.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Identify critical CVEs and cross-reference KEV catalog",
          description: "Filter for CVSS ≥ 9.0 CVEs and flag any present in the CISA Known Exploited Vulnerabilities catalog.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Create prioritized remediation tickets",
          description: "Auto-generate remediation tickets in ITSM with full CVE context, SLA assignment, and owner routing.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Apply available patches",
          description: "Trigger patch management integration to deploy vendor patches for all auto-patchable CVEs. Changes require change window approval.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Validate and re-scan",
          description: "Run a targeted re-scan on patched assets to confirm CVEs are remediated. Fail open on scan errors.",
          dryRunSafe: false,
        },
        {
          number: 6,
          title: "Write audit record",
          description: "Create signed audit event recording CVEs addressed, patch versions applied, affected systems, and validation result.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["Vulnerability Scanner", "Patch Management Platform", "ITSM / Ticketing System", "Internet-facing Assets"];
      validationChecks = [
        "Re-scan confirms zero unpatched critical CVEs on internet-facing assets",
        "All CISA KEV entries resolved or risk-accepted with documentation",
        "No service disruption detected post-patching",
        "Evidence record created in SecureWatch360",
      ];
      rollbackPlan =
        "Revert applied patches via pre-change snapshots or rollback scripts. Re-open ITSM tickets for manual review. Document rollback reason. No rollback is available for ITSM ticket creation (benign side effect).";
      break;

    case "endpoint_security":
      blastRadius = "Medium";
      steps = [
        {
          number: 1,
          title: "Query MDM for unmanaged endpoints",
          description: "Pull device inventory from MDM platform and cross-reference with EDR agent enrollment list to identify gaps.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Generate coverage report",
          description: "Produce a list of devices missing EDR coverage with last-seen timestamps, owner info, and asset classification.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Push EDR enrollment policy",
          description: "Deploy EDR agent enrollment policy via MDM to all unmanaged devices in scope.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Enable automated patch management",
          description: "Configure patch management to enforce 14-day critical and 30-day high-severity SLAs across enrolled endpoints.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Monitor enrollment and validate",
          description: "Track agent check-in status in real time. Flag devices that fail to enroll within 4 hours for manual review.",
          dryRunSafe: false,
        },
        {
          number: 6,
          title: "Write audit record",
          description: "Record devices enrolled, coverage delta before and after, and policy version applied.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["MDM Platform (Intune/Jamf)", "EDR Console", "Asset Inventory", "Patch Management"];
      validationChecks = [
        "EDR coverage ≥ 95% of all endpoints",
        "All enrolled agents actively reporting",
        "Patch SLA policy active and enforced",
        "OT-adjacent hosts enrolled or documented as exceptions",
      ];
      rollbackPlan =
        "Remove MDM policy assignment to unmanaged devices. EDR agents will self-uninstall on next check-in if policy is revoked. Notify IT team and document rollback.";
      break;

    case "backup_recovery":
      blastRadius = "Medium";
      steps = [
        {
          number: 1,
          title: "Audit current backup configuration",
          description: "Review backup jobs, schedules, retention policies, and storage destinations for completeness.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Check immutability and offsite replication",
          description: "Verify Object Lock / immutable storage status and cross-region replication configuration.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Enable backup integrity verification",
          description: "Configure the backup platform to run automated integrity checks after each backup job completes.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Configure cross-region replication",
          description: "Enable cross-region replication for DR readiness and CUI data residency requirements.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Schedule and run restoration drill",
          description: "Execute a test restore of a non-production data set. Measure RTO and RPO against CMMC targets.",
          dryRunSafe: false,
        },
        {
          number: 6,
          title: "Write audit record",
          description: "Record backup coverage, integrity verification status, drill results, and evidence artifact ID.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["Cloud Storage (S3/Azure Blob)", "Backup Service", "DR Runbook", "SecureWatch360 Evidence Vault"];
      validationChecks = [
        "Automated integrity verification active on all backup jobs",
        "Cross-region replication confirmed with lag < 1 hour",
        "Test restore completed with documented RTO and RPO",
        "Evidence artifact uploaded to SecureWatch360 vault",
      ];
      rollbackPlan =
        "Disable integrity verification job if it causes backup overhead issues. Remove cross-region replication rule (note: Object Lock changes may require a support ticket to reverse). Document rollback reason and impact.";
      break;

    case "monitoring_logging":
      blastRadius = "Low";
      steps = [
        {
          number: 1,
          title: "Inventory current log sources",
          description: "Enumerate all active cloud resources, network devices, servers, and application services.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Map to SIEM connectors and identify gaps",
          description: "Identify which sources have active SIEM connectors and produce a gap report.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Configure log forwarding rules",
          description: "Create or update forwarding rules to pipe missing sources into SIEM with correct field normalization.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Verify log ingestion and retention",
          description: "Confirm log events are arriving in SIEM within expected latency thresholds. Verify 90-day retention policy.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Deploy baseline CMMC alert rules",
          description: "Apply CMMC-required detection rules (privileged access, failed auth, config changes) to newly onboarded sources.",
          dryRunSafe: false,
        },
        {
          number: 6,
          title: "Write audit record",
          description: "Record sources connected, alert rules deployed, retention policy confirmed, and baseline test result.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["Cloud Provider (CloudTrail/Diagnostic Logs)", "SIEM Platform", "Network Devices", "Application Servers"];
      validationChecks = [
        "Log ingestion confirmed for all critical sources",
        "Retention policy verified at ≥ 90 days",
        "Baseline CMMC alert rules active and firing correctly",
        "Test event generated and received within 5 minutes",
      ];
      rollbackPlan =
        "Disable log forwarding connectors created during this run. Remove alert rules deployed. Archive any ingested logs per retention policy before disabling.";
      break;

    case "compliance_evidence":
      blastRadius = "Low";
      steps = [
        {
          number: 1,
          title: "Map control requirements to evidence types",
          description: "Identify required artifact types (scan report, policy doc, training record, etc.) for each in-scope CMMC control.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Scan existing artifacts for coverage",
          description: "Search SecureWatch360 evidence vault and document repository for existing qualifying artifacts.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Create structured evidence collection tasks",
          description: "Generate collection tasks in SecureWatch360 for all uncovered controls, with owner assignment and due dates.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Auto-attach scan exports to controls",
          description: "Link recent vulnerability scan exports, patch reports, and policy documents to matching control requirements.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Validate coverage threshold",
          description: "Confirm coverage exceeds 70% of required controls and that all critical controls have at least one artifact.",
          dryRunSafe: false,
        },
        {
          number: 6,
          title: "Write audit record",
          description: "Record controls covered, evidence artifact IDs, coverage percentage, and timestamp.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["SecureWatch360 Evidence Module", "Document Repository", "Compliance Control Catalog"];
      validationChecks = [
        "Evidence coverage > 70% of required CMMC controls",
        "All critical controls have at least one qualifying artifact",
        "Evidence vault access-controlled and audit-logged",
        "Artifact freshness < 12 months for all attached evidence",
      ];
      rollbackPlan =
        "Archive evidence collection tasks created. Revert control-to-artifact mappings. Artifacts themselves are not deleted — rollback only removes the linkages.";
      break;

    default:
      blastRadius = "Low";
      steps = [
        {
          number: 1,
          title: "Assess current configuration state",
          description: "Collect configuration data from relevant systems for this security domain.",
          dryRunSafe: true,
        },
        {
          number: 2,
          title: "Identify gaps against target state",
          description: "Compare current configuration against the desired state defined in this roadmap item.",
          dryRunSafe: true,
        },
        {
          number: 3,
          title: "Apply recommended configuration changes",
          description: "Execute the recommended action to close identified gaps.",
          dryRunSafe: false,
        },
        {
          number: 4,
          title: "Validate changes",
          description: "Confirm changes are applied correctly and produce the expected security improvement.",
          dryRunSafe: false,
        },
        {
          number: 5,
          title: "Write audit record",
          description: "Record changes made, systems affected, validation result, and agent identity.",
          dryRunSafe: true,
        },
      ];
      affectedSystems = ["SecureWatch360 Platform", "Relevant Security Controls"];
      validationChecks = [
        "Configuration matches desired state",
        "Evidence record created in SecureWatch360",
        "No service disruption detected",
      ];
      rollbackPlan =
        "Revert configuration changes to their pre-automation state. Document rollback reason and timestamp in SecureWatch360 audit log.";
  }

  return { agent, modeLabel, estimatedDuration, blastRadius, steps, affectedSystems, validationChecks, rollbackPlan };
}

// ─── Audit log generator (JSON format) ───────────────────────────────────────

function generateAuditLogJSON(item: PostureRoadmapItem, mode: ExecutionMode): string {
  const agent = CATEGORY_TO_AGENT[item.category] ?? "SecureWatch360Agent";
  const now = new Date();
  const ts = now.toISOString().split(".")[0] + "Z";
  const isDryRun = mode === "recommend_only";
  const hashSuffix = item.id.replace(/-/g, "").slice(0, 8);

  const log = {
    event: isDryRun ? "AUTOMATION_PLAN_GENERATED" : "APPROVAL_REQUEST_SUBMITTED",
    tenant_id: item.tenant_id,
    roadmap_item_id: item.id,
    roadmap_item_title: item.title,
    category: item.category,
    agent,
    mode,
    triggered_by: "sw360-analyst",
    triggered_at: ts,
    dry_run: isDryRun,
    approval_required: mode !== "recommend_only",
    auto_execute: mode === "autonomous_remediation",
    estimated_duration: EFFORT_TO_DURATION[item.estimated_effort] ?? "1–4 hours",
    impact_score: item.estimated_impact_score,
    framework: item.related_framework ?? null,
    rollback_available: true,
    status: isDryRun ? "DRY_RUN_COMPLETE" : "AWAITING_APPROVAL",
    audit_signed: true,
    audit_hash: `sha256:${hashSuffix}a3f7c9e2b1d4`,
  };

  return JSON.stringify(log, null, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeCard({
  mode,
  selected,
  onSelect,
}: {
  mode: ExecutionMode;
  selected: boolean;
  onSelect: (m: ExecutionMode) => void;
}) {
  const { label, description, Icon } = MODE_META[mode];
  return (
    <button
      onClick={() => onSelect(mode)}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background: selected ? "rgba(102,126,234,0.1)" : "rgba(102,126,234,0.03)",
        border: `1.5px solid ${selected ? "#667eea" : "#334155"}`,
        boxShadow: selected ? "0 0 0 1px rgba(102,126,234,0.2)" : "none",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: selected
              ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              : "rgba(102,126,234,0.08)",
          }}
        >
          <Icon size={15} className={selected ? "text-white" : "text-slate-400"} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: selected ? "#e2e8f0" : "#94a3b8" }}>
            {label}
          </p>
          <p className="text-xs mt-0.5 text-slate-400 leading-relaxed">{description}</p>
        </div>
        <div className="shrink-0 mt-1.5">
          <div
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
            style={{
              borderColor: selected ? "#667eea" : "#475569",
              background: selected ? "#667eea" : "transparent",
            }}
          >
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </div>
      </div>
    </button>
  );
}

function AccordionSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #334155" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-slate-700/30"
        style={{ background: "rgba(102,126,234,0.05)" }}
      >
        <span className="text-violet-400 shrink-0">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex-1 text-left">
          {title}
        </span>
        {open
          ? <ChevronUp size={13} className="text-slate-500 shrink-0" />
          : <ChevronDown size={13} className="text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-4" style={{ background: "rgba(15,23,42,0.5)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AutomationModal({ item, onClose, onRequestApproval }: AutomationModalProps) {
  const [view, setView] = useState<ModalView>("default");
  const [selectedMode, setSelectedMode] = useState<ExecutionMode>("recommend_only");
  const [refId] = useState(
    () => `SW360-AUTO-${Math.random().toString(16).slice(2, 8).toUpperCase()}`
  );

  useEffect(() => {
    if (item) {
      setView("default");
      setSelectedMode("recommend_only");
    }
  }, [item?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!item) return null;

  const agent = CATEGORY_TO_AGENT[item.category] ?? "SecureWatch360 Agent";
  const permissions = CATEGORY_TO_PERMISSIONS[item.category] ?? [];
  const duration = EFFORT_TO_DURATION[item.estimated_effort] ?? "1–4 hours";
  const risk = PRIORITY_TO_RISK[item.priority] ?? { label: "Low Risk", color: "#22c55e" };
  const plan = generateMockExecutionPlan(item, selectedMode);
  const auditJSON = generateAuditLogJSON(item, selectedMode);
  const impactColor =
    item.estimated_impact_score >= 80 ? "#22c55e"
    : item.estimated_impact_score >= 60 ? "#eab308"
    : "#94a3b8";

  function handleRequestApproval() {
    onRequestApproval(item!, selectedMode);
    setView("submitted");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-2xl flex flex-col"
        style={{
          maxWidth: 680,
          maxHeight: "92vh",
          background: "linear-gradient(175deg, #0f172a 0%, #0c1526 100%)",
          border: "1px solid rgba(102,126,234,0.35)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(102,126,234,0.1)",
          overflow: "hidden",
        }}
      >
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
          {view === "default" && (
            <DefaultView
              item={item}
              agent={agent}
              permissions={permissions}
              duration={duration}
              risk={risk}
              impactColor={impactColor}
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
              onClose={onClose}
              onPreview={() => setView("preview")}
              onRequestApproval={handleRequestApproval}
            />
          )}
          {view === "preview" && (
            <PreviewView
              item={item}
              plan={plan}
              auditJSON={auditJSON}
              selectedMode={selectedMode}
              onBack={() => setView("default")}
              onRequestApproval={handleRequestApproval}
            />
          )}
          {view === "submitted" && (
            <SubmittedView refId={refId} item={item} mode={selectedMode} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Default view ─────────────────────────────────────────────────────────────

function DefaultView({
  item, agent, permissions, duration, risk, impactColor,
  selectedMode, onSelectMode, onClose, onPreview, onRequestApproval,
}: {
  item: PostureRoadmapItem;
  agent: string;
  permissions: string[];
  duration: string;
  risk: { label: string; color: string };
  impactColor: string;
  selectedMode: ExecutionMode;
  onSelectMode: (m: ExecutionMode) => void;
  onClose: () => void;
  onPreview: () => void;
  onRequestApproval: () => void;
}) {
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
          >
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-0.5">SecureWatch360</p>
            <h2 className="text-xl font-bold text-slate-100 leading-tight">
              Automate with SecureWatch360
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-slate-700"
          style={{ color: "#94a3b8" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Item context card */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: "rgba(102,126,234,0.06)",
          border: "1px solid rgba(102,126,234,0.25)",
          borderLeft: "3px solid #667eea",
        }}
      >
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            {item.category.replace(/_/g, " ")}
          </span>
          {item.related_framework && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(102,126,234,0.15)", color: "#a78bfa" }}
            >
              {item.related_framework}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="font-bold text-slate-100 leading-snug">{item.title}</p>

        {/* Problem summary */}
        {item.current_state && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">
              Problem Summary
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{item.current_state}</p>
          </div>
        )}

        {/* Recommended action */}
        {item.recommended_action && (
          <div className="pt-1 border-t border-slate-700/50">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">
              Recommended Action
            </p>
            <p className="text-sm text-slate-200 leading-relaxed">{item.recommended_action}</p>
          </div>
        )}
      </div>

      {/* Agent row */}
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: "rgba(102,126,234,0.05)", border: "1px solid #334155" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          SecureWatch360 Agent
        </p>
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">{agent}</span>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Expected Impact */}
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(102,126,234,0.04)", border: "1px solid #334155" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Expected Impact</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tabular-nums" style={{ color: impactColor }}>
              {item.estimated_impact_score}
            </span>
            <span className="text-xs text-slate-500">/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(102,126,234,0.15)" }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${item.estimated_impact_score}%`, background: impactColor }}
            />
          </div>
        </div>

        {/* Estimated Risk */}
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(102,126,234,0.04)", border: "1px solid #334155" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Execution Risk</p>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: risk.color }} />
            <p className="text-sm font-bold" style={{ color: risk.color }}>{risk.label}</p>
          </div>
          <p className="text-xs text-slate-500">Rollback available if issues arise</p>
        </div>

        {/* Required Permissions */}
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(102,126,234,0.04)", border: "1px solid #334155" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Required Permissions</p>
          <div className="flex flex-wrap gap-1">
            {permissions.slice(0, 3).map((p) => (
              <span
                key={p}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "rgba(102,126,234,0.15)", color: "#a78bfa", border: "1px solid rgba(102,126,234,0.25)" }}
              >
                {p}
              </span>
            ))}
            {permissions.length > 3 && (
              <span className="text-xs text-slate-500 self-center">
                +{permissions.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Duration */}
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(102,126,234,0.04)", border: "1px solid #334155" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Estimated Duration</p>
          <p className="text-sm font-bold text-slate-100">{duration}</p>
          <p className="text-xs text-slate-500">No real-time changes in dry-run</p>
        </div>
      </div>

      {/* Execution mode */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5 text-slate-400">
          Execution Mode
        </p>
        <div className="space-y-2">
          {(["recommend_only", "assisted_remediation", "autonomous_remediation"] as ExecutionMode[]).map(
            (m) => (
              <ModeCard key={m} mode={m} selected={selectedMode === m} onSelect={onSelectMode} />
            )
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onPreview}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(102,126,234,0.3)",
          }}
        >
          <ClipboardList size={15} />
          Preview Automation Plan
        </button>
        <button
          onClick={onRequestApproval}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-violet-500/10"
          style={{ background: "transparent", color: "#a78bfa", border: "1.5px solid rgba(167,139,250,0.4)" }}
        >
          <Send size={14} />
          Request Approval
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors hover:text-slate-300"
          style={{ background: "transparent", color: "#64748b", border: "none" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Preview view ─────────────────────────────────────────────────────────────

function PreviewView({
  item, plan, auditJSON, selectedMode, onBack, onRequestApproval,
}: {
  item: PostureRoadmapItem;
  plan: MockExecutionPlan;
  auditJSON: string;
  selectedMode: ExecutionMode;
  onBack: () => void;
  onRequestApproval: () => void;
}) {
  const isDryRun = selectedMode === "recommend_only";
  const blastColor =
    plan.blastRadius === "High" ? "#ef4444"
    : plan.blastRadius === "Medium" ? "#f97316"
    : "#22c55e";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-700"
          style={{ background: "rgba(102,126,234,0.08)", color: "#94a3b8", border: "1px solid #334155" }}
        >
          <ArrowLeft size={12} /> Back
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Automation Preview Plan</h2>
          <p className="text-xs text-slate-400 mt-0.5 leading-tight">{item.title}</p>
        </div>
        {isDryRun && (
          <span
            className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}
          >
            DRY RUN
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Overview */}
        <AccordionSection title="Overview" icon={<Shield size={14} />}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Agent", value: plan.agent, color: "#a78bfa" },
              { label: "Mode", value: plan.modeLabel, color: "#e2e8f0" },
              { label: "Estimated Duration", value: plan.estimatedDuration, color: "#e2e8f0" },
              { label: "Blast Radius", value: plan.blastRadius, color: blastColor },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* Execution steps */}
        <AccordionSection title="Execution Steps" icon={<ClipboardList size={14} />}>
          <ol className="space-y-4">
            {plan.steps.map((step) => {
              const isSkipped = isDryRun && !step.dryRunSafe;
              return (
                <li key={step.number} className="flex gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{
                      background: isSkipped ? "rgba(148,163,184,0.1)" : "rgba(102,126,234,0.2)",
                      color: isSkipped ? "#475569" : "#a78bfa",
                      border: `1px solid ${isSkipped ? "#334155" : "rgba(102,126,234,0.4)"}`,
                    }}
                  >
                    {step.number}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: isSkipped ? "#475569" : "#e2e8f0" }}>
                        {step.title}
                      </p>
                      {isSkipped && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-mono font-bold"
                          style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)" }}
                        >
                          SKIPPED (DRY RUN)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </AccordionSection>

        {/* Affected systems */}
        <AccordionSection title="Affected Systems" icon={<Bot size={14} />}>
          <div className="flex flex-wrap gap-2">
            {plan.affectedSystems.map((sys) => (
              <span
                key={sys}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "rgba(102,126,234,0.12)", color: "#a78bfa", border: "1px solid rgba(102,126,234,0.25)" }}
              >
                {sys}
              </span>
            ))}
          </div>
        </AccordionSection>

        {/* Rollback plan */}
        <AccordionSection title="Rollback Plan" icon={<RotateCcw size={14} />}>
          <div
            className="rounded-lg p-3 text-sm text-slate-300 leading-relaxed"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderLeft: "3px solid #f97316" }}
          >
            {plan.rollbackPlan}
          </div>
        </AccordionSection>

        {/* Validation checks */}
        <AccordionSection title="Validation Checks" icon={<Check size={14} />}>
          <ul className="space-y-2">
            {plan.validationChecks.map((check) => (
              <li key={check} className="flex items-start gap-2.5 text-sm text-slate-300">
                <Check size={14} className="text-green-400 shrink-0 mt-0.5" />
                {check}
              </li>
            ))}
          </ul>
        </AccordionSection>

        {/* Audit log */}
        <AccordionSection title="Audit Log Preview" icon={<Activity size={14} />}>
          <pre
            className="text-xs rounded-lg p-4 overflow-x-auto leading-relaxed"
            style={{
              background: "rgba(0,0,0,0.5)",
              color: "#86efac",
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              border: "1px solid rgba(34,197,94,0.15)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {auditJSON}
          </pre>
        </AccordionSection>
      </div>

      {/* Buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onRequestApproval}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(102,126,234,0.3)",
          }}
        >
          <Send size={14} />
          Request Approval
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors hover:text-slate-300"
          style={{ background: "transparent", color: "#64748b", border: "none" }}
        >
          <ArrowLeft size={13} /> Back
        </button>
      </div>
    </div>
  );
}

// ─── Submitted view ───────────────────────────────────────────────────────────

function SubmittedView({
  refId,
  item,
  mode,
  onClose,
}: {
  refId: string;
  item: PostureRoadmapItem;
  mode: ExecutionMode;
  onClose: () => void;
}) {
  return (
    <div className="p-10 flex flex-col items-center text-center space-y-6">
      {/* Pulsing checkmark */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: "rgba(34,197,94,0.15)" }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "2px solid rgba(34,197,94,0.4)",
            boxShadow: "0 0 32px rgba(34,197,94,0.2)",
          }}
        >
          <Check size={32} className="text-green-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-green-400">Approval Request Submitted</h2>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
          A SecureWatch360 analyst will review this{" "}
          <span className="text-slate-300 font-medium">{MODE_META[mode].label}</span> plan
          for <span className="text-slate-300 font-medium">{item.title}</span> before any
          changes are made. You&apos;ll be notified when approved.
        </p>
      </div>

      {/* What happens next */}
      <div
        className="w-full rounded-xl p-4 text-left space-y-2.5"
        style={{ background: "rgba(102,126,234,0.06)", border: "1px solid rgba(102,126,234,0.2)" }}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-violet-400">What happens next</p>
        {[
          "Analyst reviews the automation plan and approves or requests changes",
          "No changes are made to your environment until approval is granted",
          "You receive an in-app and email notification with the decision",
          "All actions will be logged in the SecureWatch360 audit trail",
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2.5 text-xs text-slate-400">
            <Check size={12} className="text-violet-400 mt-0.5 shrink-0" />
            {step}
          </div>
        ))}
      </div>

      {/* Reference ID */}
      <div
        className="rounded-xl px-5 py-3"
        style={{ background: "rgba(102,126,234,0.08)", border: "1px solid #334155" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Reference ID</p>
        <p className="font-mono text-sm font-bold text-violet-300">{refId}</p>
      </div>

      <button
        onClick={onClose}
        className="px-8 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#fff",
          boxShadow: "0 4px 20px rgba(102,126,234,0.3)",
        }}
      >
        Close
      </button>
    </div>
  );
}
