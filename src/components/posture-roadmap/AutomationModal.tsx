"use client";

import { useState, useEffect, useCallback } from "react";
import type { PostureRoadmapItem } from "@/types/posture-roadmap";
import { ModalOverlay } from "./ModalOverlay";

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

interface MockExecutionPlan {
  agent: string;
  modeLabel: string;
  estimatedDuration: string;
  blastRadius: "Low" | "Medium" | "High";
  steps: ExecutionStep[];
  affectedSystems: string[];
  validationChecks: string[];
  rollbackSteps: string[];
}

// ─── Static mappings ─────────────────────────────────────────────────────────

const CATEGORY_TO_AGENT: Record<string, string> = {
  identity_access: "Identity & Access Agent",
  endpoint_security: "Endpoint Security Agent",
  vulnerability_management: "Vulnerability Remediation Agent",
  network_security: "Network Security Agent",
  backup_recovery: "Backup & Recovery Agent",
  monitoring_logging: "Monitoring & Logging Agent",
  compliance_evidence: "Compliance Evidence Agent",
  security_awareness: "Security Awareness Agent",
  incident_response: "Incident Response Agent",
};

const CATEGORY_TO_PERMISSIONS: Record<string, string[]> = {
  identity_access: ["IdP Admin", "Conditional Access Write", "User Read"],
  endpoint_security: ["MDM Admin", "EDR Console Write", "Asset Inventory Read"],
  vulnerability_management: ["Scanner Read", "ITSM Write", "Patch Management Write"],
  network_security: ["Firewall Read", "Network Config Write"],
  backup_recovery: ["Storage Admin", "Replication Config Write"],
  monitoring_logging: ["SIEM Admin", "Log Source Config Write"],
  compliance_evidence: ["SecureWatch360 Evidence Write", "Document Repository Read"],
  security_awareness: ["Training Platform Admin", "HR System Read"],
  incident_response: ["IRP Document Write", "Stakeholder Notify"],
};

const EFFORT_TO_DURATION: Record<string, string> = {
  low: "15–30 min",
  medium: "1–4 hours",
  high: "4–24 hours",
};

const PRIORITY_TO_RISK: Record<string, string> = {
  critical: "High Risk",
  high: "Medium Risk",
  medium: "Low Risk",
  low: "Minimal Risk",
};

const MODE_LABELS: Record<ExecutionMode, string> = {
  recommend_only: "Recommend Only",
  assisted_remediation: "Assisted Remediation",
  autonomous_remediation: "Autonomous Remediation",
};

// ─── Plan generator ───────────────────────────────────────────────────────────

function generateMockExecutionPlan(
  item: PostureRoadmapItem,
  mode: ExecutionMode
): MockExecutionPlan {
  const agent = CATEGORY_TO_AGENT[item.category] ?? "SecureWatch360 Agent";
  const modeLabel = MODE_LABELS[mode];
  const estimatedDuration = EFFORT_TO_DURATION[item.estimated_effort] ?? "1–4 hours";
  const isDryRun = mode === "recommend_only";
  const isActive = !isDryRun;

  let steps: ExecutionStep[];
  let affectedSystems: string[];
  let validationChecks: string[];
  let rollbackSteps: string[];
  let blastRadius: "Low" | "Medium" | "High";

  switch (item.category) {
    case "identity_access":
      blastRadius = "Medium";
      steps = [
        { number: 1, title: "Enumerate privileged accounts", description: "Query IdP for all accounts with admin, privileged, or elevated roles." },
        { number: 2, title: "Identify accounts without MFA", description: "Cross-reference MFA enrollment records against the privileged account list." },
        { number: 3, title: "Generate compliance report", description: "Produce a detailed report of MFA gaps with account details and last sign-in data." },
        ...(isActive ? [
          { number: 4, title: "Apply Conditional Access policy", description: "Configure IdP policy to require MFA for all identified accounts on next sign-in." },
          { number: 5, title: "Send enrollment notifications", description: "Dispatch automated enrollment prompts to affected users via email and in-app." },
        ] : []),
      ];
      affectedSystems = ["Azure Active Directory / Entra ID", "IdP MFA Service", "Conditional Access Engine"];
      validationChecks = ["MFA enrollment rate > 95%", "No admin lockouts detected", "Sign-in logs reviewed for anomalies"];
      rollbackSteps = ["Disable Conditional Access policy", "Notify affected users of rollback"];
      break;

    case "vulnerability_management":
      blastRadius = "High";
      steps = [
        { number: 1, title: "Pull current vulnerability scan results", description: "Fetch latest scan data from vulnerability scanner, filtered to internet-facing assets." },
        { number: 2, title: "Identify critical CVEs", description: "Filter for CVEs with CVSS score ≥ 9.0 on externally reachable hosts." },
        { number: 3, title: "Cross-reference KEV catalog", description: "Flag any CVEs present in CISA Known Exploited Vulnerabilities catalog." },
        ...(isActive ? [
          { number: 4, title: "Create remediation tickets in ITSM", description: "Auto-generate prioritized remediation tickets with full CVE context and SLA assignment." },
          { number: 5, title: "Apply available patches", description: "Trigger patch management integration to deploy vendor patches for all auto-patchable CVEs." },
        ] : []),
      ];
      affectedSystems = ["Vulnerability Scanner", "Patch Management Platform", "ITSM / Ticketing System"];
      validationChecks = ["Re-scan confirms CVEs remediated", "No service disruption detected", "Evidence record created"];
      rollbackSteps = ["Revert patch via snapshot", "Re-open ITSM tickets for manual review"];
      break;

    case "endpoint_security":
      blastRadius = "Medium";
      steps = [
        { number: 1, title: "Query MDM for unmanaged endpoints", description: "Pull device inventory from MDM platform and cross-reference with EDR agent enrollment list." },
        { number: 2, title: "Generate unmanaged device report", description: "Produce a list of devices missing EDR coverage with last-seen timestamps and owner info." },
        ...(isActive ? [
          { number: 3, title: "Push EDR enrollment policy", description: "Deploy EDR agent enrollment policy via MDM to all unmanaged devices in scope." },
          { number: 4, title: "Monitor enrollment progress", description: "Track agent check-in status in real time and flag devices that fail to enroll within 4 hours." },
        ] : []),
      ];
      affectedSystems = ["MDM Platform (Intune/Jamf)", "EDR Console", "Asset Inventory"];
      validationChecks = ["Coverage ≥ 95%", "All enrolled agents reporting"];
      rollbackSteps = ["Remove MDM policy assignment", "Notify IT team"];
      break;

    case "monitoring_logging":
      blastRadius = "Low";
      steps = [
        { number: 1, title: "Inventory current log sources", description: "Enumerate all active cloud resources, network devices, and application services." },
        { number: 2, title: "Map to SIEM connectors", description: "Identify which sources have active SIEM connectors and flag gaps." },
        ...(isActive ? [
          { number: 3, title: "Configure log forwarding rules", description: "Create or update forwarding rules to pipe missing sources into SIEM." },
          { number: 4, title: "Verify log ingestion", description: "Confirm log events are arriving in SIEM within expected latency thresholds." },
          { number: 5, title: "Deploy initial alert rules", description: "Apply baseline detection rules for the newly onboarded log sources." },
        ] : []),
      ];
      affectedSystems = ["Cloud Provider (CloudTrail/Diagnostic Logs)", "SIEM Platform", "Network Devices"];
      validationChecks = ["Log ingestion confirmed", "Retention policy verified at 90 days", "Test alert fired"];
      rollbackSteps = ["Disable log forwarding connectors", "Archive ingested logs"];
      break;

    case "compliance_evidence":
      blastRadius = "Low";
      steps = [
        { number: 1, title: "Map control requirements to evidence types", description: "Identify required artifact types for each in-scope control (scan report, policy doc, training record, etc.)." },
        { number: 2, title: "Scan existing artifacts for coverage", description: "Search SecureWatch360 evidence module and document repository for existing qualifying artifacts." },
        ...(isActive ? [
          { number: 3, title: "Create evidence collection tasks", description: "Generate structured collection tasks in SecureWatch360 for all uncovered controls." },
          { number: 4, title: "Link existing scan exports to controls", description: "Auto-attach recent scan exports and policy documents to matching control requirements." },
        ] : []),
      ];
      affectedSystems = ["SecureWatch360 Evidence Module", "Document Repository", "Compliance Control Catalog"];
      validationChecks = ["Coverage > 70% of required controls", "All critical controls have at least 1 artifact"];
      rollbackSteps = ["Archive evidence tasks", "Revert control mappings"];
      break;

    case "backup_recovery":
      blastRadius = "Medium";
      steps = [
        { number: 1, title: "Audit current backup configuration", description: "Review backup jobs, schedules, retention policies, and storage destinations." },
        { number: 2, title: "Check immutability and offsite settings", description: "Verify Object Lock status and cross-region replication configuration." },
        ...(isActive ? [
          { number: 3, title: "Enable immutable storage", description: "Apply Object Lock / immutable storage policy to backup buckets." },
          { number: 4, title: "Configure cross-region replication", description: "Enable cross-region replication for DR readiness." },
          { number: 5, title: "Schedule recovery test", description: "Create a scheduled recovery drill task in the DR runbook system." },
        ] : []),
      ];
      affectedSystems = ["Cloud Storage (S3/Azure Blob)", "Backup Service", "DR Runbook"];
      validationChecks = ["Immutability policy active", "Cross-region replication confirmed", "Test restore completed"];
      rollbackSteps = ["Disable Object Lock (requires support ticket)", "Remove replication rule"];
      break;

    default:
      blastRadius = "Low";
      steps = [
        { number: 1, title: "Assess current configuration state", description: "Collect configuration data from relevant systems for this security domain." },
        { number: 2, title: "Identify gaps against target state", description: "Compare current configuration against the desired state defined in the roadmap item." },
        ...(isActive ? [
          { number: 3, title: "Apply recommended configuration changes", description: "Execute the recommended action to close identified gaps." },
          { number: 4, title: "Validate and document changes", description: "Confirm changes are applied and create an evidence record in SecureWatch360." },
        ] : []),
      ];
      affectedSystems = ["SecureWatch360 Platform", "Relevant Security Controls"];
      validationChecks = ["Configuration matches desired state", "Evidence record created", "No service disruption"];
      rollbackSteps = ["Revert configuration changes", "Document rollback in audit log"];
  }

  return { agent, modeLabel, estimatedDuration, blastRadius, steps, affectedSystems, validationChecks, rollbackSteps };
}

// ─── Helper: generate audit log preview ──────────────────────────────────────

function generateAuditLogPreview(item: PostureRoadmapItem, mode: ExecutionMode): string {
  const now = new Date().toISOString();
  const ts = (offset: number) =>
    new Date(Date.now() + offset * 1000).toISOString().replace("T", "T").split(".")[0] + "Z";
  const agent = CATEGORY_TO_AGENT[item.category] ?? "SecureWatch360Agent";
  const agentKey = agent.replace(/\s+/g, "");
  return [
    `[${ts(0)}] AUTOMATION_INITIATED agent=${agentKey} mode=${mode}`,
    `[${ts(1)}] SCOPE_CHECK tenant=<tenant_id> item_id=${item.id.slice(0, 8)}`,
    `[${ts(2)}] PERMISSION_VERIFY perms=${(CATEGORY_TO_PERMISSIONS[item.category] ?? []).join(",")}`,
    `[${ts(3)}] ${mode === "recommend_only" ? "DRY_RUN" : "STEP_EXEC"} step=1 action="Assess scope" status=pending`,
    `[${ts(4)}] ${mode === "recommend_only" ? "DRY_RUN" : "STEP_EXEC"} step=2 action="Evaluate gaps" status=pending`,
    ...(mode !== "recommend_only"
      ? [`[${ts(5)}] APPROVAL_GATE mode=${mode} status=awaiting_approval`]
      : [`[${ts(5)}] DRY_RUN_COMPLETE recommendations_ready=true`]),
  ].join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeCard({
  mode,
  icon,
  title,
  description,
  selected,
  onSelect,
}: {
  mode: ExecutionMode;
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (m: ExecutionMode) => void;
}) {
  return (
    <button
      onClick={() => onSelect(mode)}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background: selected
          ? "rgba(0,229,255,0.06)"
          : "rgba(176,196,222,0.04)",
        border: `1.5px solid ${selected ? "#00e5ff" : "rgba(176,196,222,0.18)"}`,
        boxShadow: selected ? "0 0 16px rgba(0,229,255,0.1)" : "none",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{icon}</span>
        <div>
          <p
            className="text-sm font-bold"
            style={{ color: selected ? "#00e5ff" : "#e6edf5" }}
          >
            {title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#8ab4d4" }}>
            {description}
          </p>
        </div>
        <div className="ml-auto shrink-0 mt-1">
          <div
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: selected ? "#00e5ff" : "rgba(176,196,222,0.35)",
              background: selected ? "#00e5ff" : "transparent",
            }}
          >
            {selected && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#07111f]" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function AccordionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(176,196,222,0.15)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(176,196,222,0.05)" }}
      >
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: "#29b6f6", fontFamily: "Rajdhani, Inter, sans-serif" }}
        >
          {title}
        </span>
        <span style={{ color: "#8ab4d4", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-3" style={{ background: "rgba(7,17,31,0.4)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AutomationModal({
  item,
  onClose,
  onRequestApproval,
}: AutomationModalProps) {
  const [view, setView] = useState<ModalView>("default");
  const [selectedMode, setSelectedMode] = useState<ExecutionMode>("recommend_only");
  const [refId] = useState(
    () => `SW360-AUTO-${Math.random().toString(16).slice(2, 8).toUpperCase()}`
  );

  // Reset to default view whenever a new item opens
  useEffect(() => {
    if (item) {
      setView("default");
      setSelectedMode("recommend_only");
    }
  }, [item?.id]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
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
  const riskLabel = PRIORITY_TO_RISK[item.priority] ?? "Low Risk";
  const plan = generateMockExecutionPlan(item, selectedMode);
  const auditLog = generateAuditLogPreview(item, selectedMode);

  const impactColor =
    item.estimated_impact_score >= 80
      ? "#22c55e"
      : item.estimated_impact_score >= 60
      ? "#eab308"
      : "#8ab4d4";

  function handleRequestApproval() {
    onRequestApproval(item!, selectedMode);
    setView("submitted");
  }

  // ── Overlay + centering wrapper ──────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backdropFilter: "blur(8px)",
        background: "rgba(7,17,31,0.75)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full rounded-2xl flex flex-col animate-slide-in"
        style={{
          maxWidth: 680,
          maxHeight: "90vh",
          background: "linear-gradient(175deg, #0d1e33 0%, #07111f 100%)",
          border: "1px solid rgba(0,229,255,0.25)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(0,229,255,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
          {view === "default" && (
            <DefaultView
              item={item}
              agent={agent}
              permissions={permissions}
              duration={duration}
              riskLabel={riskLabel}
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
              auditLog={auditLog}
              selectedMode={selectedMode}
              onBack={() => setView("default")}
              onRequestApproval={handleRequestApproval}
            />
          )}
          {view === "submitted" && (
            <SubmittedView refId={refId} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Default view ─────────────────────────────────────────────────────────────

function DefaultView({
  item,
  agent,
  permissions,
  duration,
  riskLabel,
  impactColor,
  selectedMode,
  onSelectMode,
  onClose,
  onPreview,
  onRequestApproval,
}: {
  item: PostureRoadmapItem;
  agent: string;
  permissions: string[];
  duration: string;
  riskLabel: string;
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
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
            style={{
              background: "rgba(0,229,255,0.1)",
              border: "1.5px solid rgba(0,229,255,0.35)",
              boxShadow: "0 0 20px #00e5ff44",
            }}
          >
            ⚡
          </div>
          <div>
            <p className="sw-kicker mb-0.5">SecureWatch360</p>
            <h2
              className="text-2xl font-bold leading-tight"
              style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#fff" }}
            >
              Automate with SecureWatch360
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-lg w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
          style={{ color: "#8ab4d4", background: "rgba(176,196,222,0.08)" }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Item context card */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{
          background: "rgba(0,229,255,0.04)",
          border: "1px solid rgba(0,229,255,0.2)",
          borderLeft: "3px solid #00e5ff",
        }}
      >
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(41,182,246,0.15)",
              color: "#29b6f6",
              border: "1px solid rgba(41,182,246,0.3)",
            }}
          >
            {item.category.replace(/_/g, " ")}
          </span>
          {item.related_framework && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(41,182,246,0.1)", color: "#29b6f6" }}
            >
              {item.related_framework}
            </span>
          )}
        </div>
        <p className="font-bold text-sm" style={{ color: "#e6edf5" }}>
          {item.title}
        </p>
        {item.recommended_action && (
          <div>
            <p
              className="text-xs uppercase tracking-wider font-semibold mb-1"
              style={{ color: "#8ab4d4" }}
            >
              Recommended Action
            </p>
            <p className="text-sm" style={{ color: "#c7dce8" }}>
              {item.recommended_action}
            </p>
          </div>
        )}
      </div>

      {/* Agent info row */}
      <div
        className="rounded-xl p-3 flex items-center justify-between"
        style={{ background: "rgba(176,196,222,0.05)", border: "1px solid rgba(176,196,222,0.12)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8ab4d4" }}>
          SecureWatch360 Agent
        </span>
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-sm font-semibold" style={{ color: "#29b6f6" }}>
            {agent}
          </span>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Expected Impact */}
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(176,196,222,0.04)", border: "1px solid rgba(176,196,222,0.1)" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#8ab4d4" }}>
            Expected Impact
          </p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums" style={{ color: impactColor }}>
              {item.estimated_impact_score}
            </span>
            <span className="text-xs" style={{ color: "#8ab4d4" }}>/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(176,196,222,0.15)" }}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${item.estimated_impact_score}%`, background: impactColor }}
            />
          </div>
        </div>

        {/* Estimated Risk */}
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(176,196,222,0.04)", border: "1px solid rgba(176,196,222,0.1)" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#8ab4d4" }}>
            Estimated Risk
          </p>
          <p
            className="text-sm font-bold"
            style={{
              color:
                riskLabel === "High Risk"
                  ? "#ef4444"
                  : riskLabel === "Medium Risk"
                  ? "#f97316"
                  : riskLabel === "Low Risk"
                  ? "#eab308"
                  : "#22c55e",
            }}
          >
            {riskLabel}
          </p>
        </div>

        {/* Required Permissions */}
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(176,196,222,0.04)", border: "1px solid rgba(176,196,222,0.1)" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#8ab4d4" }}>
            Required Permissions
          </p>
          <div className="flex flex-wrap gap-1">
            {permissions.slice(0, 3).map((p) => (
              <span
                key={p}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: "rgba(21,101,192,0.25)", color: "#29b6f6", border: "1px solid rgba(41,182,246,0.2)" }}
              >
                {p}
              </span>
            ))}
            {permissions.length > 3 && (
              <span className="text-xs" style={{ color: "#8ab4d4" }}>
                +{permissions.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Estimated Duration */}
        <div
          className="rounded-xl p-3 space-y-1.5"
          style={{ background: "rgba(176,196,222,0.04)", border: "1px solid rgba(176,196,222,0.1)" }}
        >
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#8ab4d4" }}>
            Estimated Duration
          </p>
          <p className="text-sm font-bold" style={{ color: "#e6edf5" }}>
            {duration}
          </p>
        </div>
      </div>

      {/* Execution mode selector */}
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "#8ab4d4" }}>
          Execution Mode
        </p>
        <div className="space-y-2">
          <ModeCard
            mode="recommend_only"
            icon="🔍"
            title="Recommend Only"
            description="Show what would be done. No changes made."
            selected={selectedMode === "recommend_only"}
            onSelect={onSelectMode}
          />
          <ModeCard
            mode="assisted_remediation"
            icon="🤝"
            title="Assisted Remediation"
            description="Agent prepares the action. You approve each step."
            selected={selectedMode === "assisted_remediation"}
            onSelect={onSelectMode}
          />
          <ModeCard
            mode="autonomous_remediation"
            icon="⚡"
            title="Autonomous Remediation"
            description="Agent executes fully. Requires admin approval."
            selected={selectedMode === "autonomous_remediation"}
            onSelect={onSelectMode}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onPreview}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            background: "linear-gradient(135deg, #00bcd4, #0097a7)",
            color: "#fff",
            border: "none",
            boxShadow: "0 4px 20px rgba(0,229,255,0.2)",
          }}
        >
          Preview Automation Plan
        </button>
        <button
          onClick={onRequestApproval}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            background: "transparent",
            color: "#29b6f6",
            border: "1.5px solid rgba(41,182,246,0.45)",
          }}
        >
          Request Approval
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "transparent", color: "#8ab4d4", border: "none" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Preview view ─────────────────────────────────────────────────────────────

function PreviewView({
  item,
  plan,
  auditLog,
  selectedMode,
  onBack,
  onRequestApproval,
}: {
  item: PostureRoadmapItem;
  plan: MockExecutionPlan;
  auditLog: string;
  selectedMode: ExecutionMode;
  onBack: () => void;
  onRequestApproval: () => void;
}) {
  const isDryRun = selectedMode === "recommend_only";

  const blastColor =
    plan.blastRadius === "High"
      ? "#ef4444"
      : plan.blastRadius === "Medium"
      ? "#f97316"
      : "#22c55e";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{ background: "rgba(176,196,222,0.08)", color: "#8ab4d4", border: "1px solid rgba(176,196,222,0.15)" }}
        >
          ← Back
        </button>
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#fff" }}
          >
            Automation Preview Plan
          </h2>
          <p className="text-xs" style={{ color: "#8ab4d4" }}>
            {item.title}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Overview */}
        <AccordionSection title="Overview">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Agent", value: plan.agent },
              { label: "Mode", value: plan.modeLabel },
              { label: "Estimated Duration", value: plan.estimatedDuration },
              { label: "Blast Radius", value: plan.blastRadius, color: blastColor },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs" style={{ color: "#8ab4d4" }}>{label}</p>
                <p className="text-sm font-semibold" style={{ color: color ?? "#e6edf5" }}>{value}</p>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* Execution steps */}
        <AccordionSection title="Execution Steps">
          <ol className="space-y-3">
            {plan.steps.map((step) => (
              <li key={step.number} className="flex gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: "rgba(0,229,255,0.15)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.3)" }}
                >
                  {step.number}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold" style={{ color: "#e6edf5" }}>
                      {step.title}
                    </p>
                    {isDryRun && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-mono font-bold"
                        style={{ background: "rgba(234,179,8,0.15)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}
                      >
                        DRY RUN
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "#8ab4d4" }}>
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </AccordionSection>

        {/* Affected systems */}
        <AccordionSection title="Affected Systems">
          <div className="flex flex-wrap gap-2">
            {plan.affectedSystems.map((sys) => (
              <span
                key={sys}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "rgba(21,101,192,0.2)", color: "#29b6f6", border: "1px solid rgba(41,182,246,0.25)" }}
              >
                {sys}
              </span>
            ))}
          </div>
        </AccordionSection>

        {/* Validation checks */}
        <AccordionSection title="Validation Checks">
          <ul className="space-y-1.5">
            {plan.validationChecks.map((check) => (
              <li key={check} className="flex items-start gap-2 text-sm" style={{ color: "#c7dce8" }}>
                <span style={{ color: "#22c55e", fontSize: 14, marginTop: 1 }}>✓</span>
                {check}
              </li>
            ))}
          </ul>
        </AccordionSection>

        {/* Rollback plan */}
        <AccordionSection title="Rollback Plan">
          <ol className="space-y-1.5">
            {plan.rollbackSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-sm" style={{ color: "#c7dce8" }}>
                <span
                  className="text-xs font-bold shrink-0 mt-0.5"
                  style={{ color: "#f97316", minWidth: 18 }}
                >
                  {i + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </AccordionSection>

        {/* Audit log preview */}
        <AccordionSection title="Audit Log Preview">
          <pre
            className="text-xs rounded-lg p-3 overflow-x-auto"
            style={{
              background: "rgba(0,0,0,0.4)",
              color: "#86efac",
              fontFamily: "'Courier New', Courier, monospace",
              lineHeight: 1.6,
              border: "1px solid rgba(34,197,94,0.15)",
            }}
          >
            {auditLog}
          </pre>
        </AccordionSection>
      </div>

      {/* Bottom buttons */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onRequestApproval}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{
            background: "linear-gradient(135deg, #00bcd4, #0097a7)",
            color: "#fff",
            border: "none",
            boxShadow: "0 4px 20px rgba(0,229,255,0.2)",
          }}
        >
          Request Approval
        </button>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: "transparent", color: "#8ab4d4", border: "none" }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

// ─── Submitted view ───────────────────────────────────────────────────────────

function SubmittedView({ refId, onClose }: { refId: string; onClose: () => void }) {
  return (
    <div className="p-10 flex flex-col items-center text-center space-y-5">
      {/* Pulsing checkmark */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: "rgba(34,197,94,0.2)" }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{
            background: "rgba(34,197,94,0.15)",
            border: "2px solid rgba(34,197,94,0.5)",
            boxShadow: "0 0 32px rgba(34,197,94,0.25)",
          }}
        >
          ✓
        </div>
      </div>

      <div className="space-y-2">
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#22c55e" }}
        >
          Approval Request Submitted
        </h2>
        <p className="text-sm" style={{ color: "#8ab4d4", maxWidth: 440, margin: "0 auto" }}>
          An analyst will review this automation plan and confirm before any changes are
          made. You&apos;ll be notified when the request is reviewed.
        </p>
      </div>

      <div
        className="rounded-xl px-5 py-3"
        style={{ background: "rgba(176,196,222,0.06)", border: "1px solid rgba(176,196,222,0.15)" }}
      >
        <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: "#8ab4d4" }}>
          Reference ID
        </p>
        <p className="font-mono text-sm font-bold" style={{ color: "#00e5ff" }}>
          {refId}
        </p>
      </div>

      <button
        onClick={onClose}
        className="px-8 py-3 rounded-xl text-sm font-bold mt-2"
        style={{
          background: "linear-gradient(135deg, #1565c0, #1e88e5)",
          color: "#fff",
          border: "none",
          boxShadow: "0 4px 20px rgba(21,101,192,0.3)",
        }}
      >
        Close
      </button>
    </div>
  );
}
