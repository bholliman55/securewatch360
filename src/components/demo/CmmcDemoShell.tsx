"use client";

import Image from "next/image";

/**
 * CmmcDemoShell — Self-contained CMMC Level 2 compliance drift + recovery demo.
 *
 * Scenario: DefenseCore Solutions (DoD contractor) managed by Northstar Managed IT.
 * Five CMMC controls drift out of compliance. SecureWatch360 detects, reasons, and
 * auto-remediates each one — returning the organization to full compliance.
 *
 * Phases:
 *   idle        → awaiting start
 *   baseline    → showing fully compliant state (brief)
 *   drifting    → controls fail one by one (score drops 100 → 72%)
 *   detecting   → SecureWatch agents scan and classify violations
 *   remediating → auto-remediation runs per control, score climbs back
 *   compliant   → all controls green, 100%, audit evidence ready
 *
 * No database or network calls — fully deterministic timer-driven state machine.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoPhase =
  | "idle"
  | "baseline"
  | "drifting"
  | "detecting"
  | "remediating"
  | "compliant";

type ControlStatus =
  | "pass"
  | "drifted"
  | "detecting"
  | "remediating"
  | "fixed";

interface CmmcControl {
  id: string;
  domain: string;
  practice: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  violation: string;
  remediationAction: string;
  agentReasoning: string;
  status: ControlStatus;
  driftOffsetMs: number;
  remediateOffsetMs: number;
}

interface ActivityEntry {
  id: string;
  ts: number;
  type: "drift" | "detection" | "remediation" | "evidence" | "system";
  message: string;
  controlId?: string;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const CLIENT = {
  name: "DefenseCore Solutions",
  msp: "Northstar Managed IT",
  contract: "DARPA Subcontract #DC-2026-0041",
  certificationLevel: "CMMC Level 2",
  cuiSystems: 14,
  lastAssessment: "2026-03-12",
};

const INITIAL_CONTROLS: CmmcControl[] = [
  {
    id: "AC.1.001",
    domain: "Access Control",
    practice: "AC.1.001",
    title: "Limit system access to authorized users",
    description: "Access to CUI systems must be limited to authorized users, processes, and devices.",
    severity: "critical",
    violation: "MFA disabled on 4 privileged admin accounts (svc-backup, svc-deploy, admin-dc1, admin-dc2)",
    remediationAction: "Enforced MFA via Conditional Access Policy; accounts locked pending re-enrollment",
    agentReasoning:
      "Agent 2 correlated 4 admin accounts with MFA enforcement gap. CMMC AC.1.001 requires all CUI-system access to use multi-factor authentication. Risk: unauthenticated lateral movement to CUI store. Auto-remediation: enforce CA policy, notify account owners.",
    status: "pass",
    driftOffsetMs: 4000,
    remediateOffsetMs: 2000,
  },
  {
    id: "SC.3.177",
    domain: "System & Comm. Protection",
    practice: "SC.3.177",
    title: "Employ FIPS-validated cryptography for CUI",
    description: "CUI must be encrypted at rest and in transit using FIPS 140-2 validated algorithms.",
    severity: "critical",
    violation: "S3 bucket 'dc-cui-archive-prod' found with server-side encryption disabled — 2.4 GB CUI data exposed",
    remediationAction: "Applied AES-256/SSE-S3 encryption; bucket policy updated to deny unencrypted PutObject",
    agentReasoning:
      "Agent 3 detected unencrypted CUI storage via cloud config scan. SC.3.177 mandates FIPS cryptography for all CUI at rest. 2.4 GB exposure window. Auto-remediation applied SSE-KMS with FIPS 140-2 key, updated bucket policy to block future unencrypted writes.",
    status: "pass",
    driftOffsetMs: 7500,
    remediateOffsetMs: 3500,
  },
  {
    id: "AU.2.042",
    domain: "Audit & Accountability",
    practice: "AU.2.042",
    title: "Ensure audit log retention meets policy",
    description: "Audit logs for CUI systems must be retained for a minimum of 90 days.",
    severity: "high",
    violation: "CloudTrail log retention on CUI account set to 61 days — 29-day shortfall vs. 90-day requirement",
    remediationAction: "Updated CloudTrail retention to 365 days; S3 lifecycle policy set to 90-day minimum",
    agentReasoning:
      "Agent 5 flagged audit log retention shortfall during scheduled compliance scan. AU.2.042 mandates 90-day minimum for all CUI-system event logs. 29-day gap creates evidence gap for audit trail. Auto-remediation extended CloudTrail retention and applied S3 lifecycle rule.",
    status: "pass",
    driftOffsetMs: 11000,
    remediateOffsetMs: 5000,
  },
  {
    id: "IA.3.083",
    domain: "Identification & Auth",
    practice: "IA.3.083",
    title: "Employ replay-resistant authentication",
    description: "Privileged access reviews must be completed on a 30-day cycle for all CUI systems.",
    severity: "high",
    violation: "Privileged access review for CUI domain overdue by 17 days — last review: 2026-03-22",
    remediationAction: "Triggered automated PAR workflow; 23 accounts reviewed, 3 de-provisioned, evidence logged",
    agentReasoning:
      "Agent 1 found privileged access review overdue for CUI domain accounts. IA.3.083 requires replay-resistant controls and periodic review. 17-day overdue window. Auto-remediation triggered PAR workflow via ITSM connector, completed review for 23 accounts, de-provisioned 3 stale accounts.",
    status: "pass",
    driftOffsetMs: 15000,
    remediateOffsetMs: 6500,
  },
  {
    id: "CM.2.061",
    domain: "Configuration Mgmt",
    practice: "CM.2.061",
    title: "Establish and maintain baseline configurations",
    description: "Unauthorized software must not be present on CUI workstations.",
    severity: "medium",
    violation: "Unauthorized P2P client 'uTorrent 3.6.0' detected on CUI workstation WS-DEFCORE-07 (user: j.harmon)",
    remediationAction: "Software quarantined via EDR; CM baseline restored; user notified and re-trained",
    agentReasoning:
      "Agent 4 identified unauthorized P2P software on CUI-classified endpoint via EDR telemetry. CM.2.061 prohibits non-baseline software on CUI systems — exfiltration risk. Auto-remediation quarantined process, removed binary, restored CM baseline, flagged user for security training.",
    status: "pass",
    driftOffsetMs: 19000,
    remediateOffsetMs: 8000,
  },
];

const BASELINE_SCORE = 100;
const DRIFTED_SCORE = 72;

function scoreAtPhase(controls: CmmcControl[]): number {
  const passing = controls.filter(
    (c) => c.status === "pass" || c.status === "fixed",
  ).length;
  return Math.round((passing / controls.length) * 100);
}

function phaseLabel(phase: DemoPhase): string {
  const map: Record<DemoPhase, string> = {
    idle: "Ready",
    baseline: "Baseline",
    drifting: "Drift Detected",
    detecting: "Analyzing",
    remediating: "Remediating",
    compliant: "Compliant",
  };
  return map[phase];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CmmcDemoShell(): React.JSX.Element {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [controls, setControls] = useState<CmmcControl[]>(INITIAL_CONTROLS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedControl, setSelectedControl] = useState<CmmcControl | null>(null);
  const [speed, setSpeed] = useState<1 | 3>(1);

  const startTsRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityEndRef = useRef<HTMLDivElement | null>(null);

  const addActivity = useCallback(
    (entry: Omit<ActivityEntry, "id" | "ts">) => {
      setActivity((prev) => [
        ...prev,
        { ...entry, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
      ]);
    },
    [],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startTsRef.current = null;
    setPhase("idle");
    setControls(INITIAL_CONTROLS.map((c) => ({ ...c, status: "pass" })));
    setActivity([]);
    setElapsedMs(0);
    setSelectedControl(null);
  }, []);

  const startDemo = useCallback(
    (multiplier: 1 | 3) => {
      reset();
      setSpeed(multiplier);

      // Give React a tick to flush the reset before starting.
      requestAnimationFrame(() => {
        startTsRef.current = Date.now();
        setPhase("baseline");

        addActivity({
          type: "system",
          message: "SecureWatch360 connected to DefenseCore Solutions CUI environment.",
        });
        addActivity({
          type: "system",
          message: "CMMC Level 2 continuous compliance monitoring active — 14 CUI systems in scope.",
        });

        // Schedule control drift and detection events
        const schedule = (delayMs: number, fn: () => void) => {
          setTimeout(fn, delayMs / multiplier);
        };

        // Phase: baseline → drifting
        schedule(3000, () => {
          setPhase("drifting");
          addActivity({
            type: "system",
            message: "⚠ Configuration change events detected in CUI environment. Beginning drift analysis…",
          });
        });

        // Drift each control
        INITIAL_CONTROLS.forEach((ctrl) => {
          schedule(ctrl.driftOffsetMs, () => {
            setControls((prev) =>
              prev.map((c) =>
                c.id === ctrl.id ? { ...c, status: "drifted" } : c,
              ),
            );
            addActivity({
              type: "drift",
              controlId: ctrl.id,
              message: `${ctrl.practice} [${ctrl.domain}] — ${ctrl.violation}`,
            });
          });
        });

        // Phase: detecting (after last drift)
        // lastDrift = 19000ms; detecting window = 20500ms → 24000ms (3500ms).
        // Each agent analysis is staggered 600ms apart so all 5 complete
        // before remediating begins — regardless of speed multiplier.
        const lastDrift = Math.max(...INITIAL_CONTROLS.map((c) => c.driftOffsetMs));
        schedule(lastDrift + 1500, () => {
          setPhase("detecting");
          addActivity({
            type: "detection",
            message: "AI agents dispatched — analyzing 5 control violations across access control, cryptography, audit, identity, and configuration domains.",
          });
          INITIAL_CONTROLS.forEach((ctrl, idx) => {
            // Stagger relative to when the detecting phase callback fires (now),
            // not relative to simulation start.
            schedule(400 + idx * 600, () => {
              setControls((prev) =>
                prev.map((c) =>
                  c.id === ctrl.id ? { ...c, status: "detecting" } : c,
                ),
              );
              addActivity({
                type: "detection",
                controlId: ctrl.id,
                message: `Agent analysis complete for ${ctrl.practice}: ${ctrl.agentReasoning.substring(0, 90)}…`,
              });
            });
          });
        });

        // Phase: remediating
        schedule(lastDrift + 5000, () => {
          setPhase("remediating");
          addActivity({
            type: "system",
            message: "Auto-remediation authorized. SecureWatch360 agents executing remediation actions…",
          });
        });

        // Remediate each control
        let remOffset = lastDrift + 5000;
        INITIAL_CONTROLS.forEach((ctrl) => {
          remOffset += ctrl.remediateOffsetMs;
          const capturedOffset = remOffset;
          schedule(capturedOffset, () => {
            setControls((prev) =>
              prev.map((c) =>
                c.id === ctrl.id ? { ...c, status: "remediating" } : c,
              ),
            );
          });
          schedule(capturedOffset + 1500, () => {
            setControls((prev) =>
              prev.map((c) =>
                c.id === ctrl.id ? { ...c, status: "fixed" } : c,
              ),
            );
            addActivity({
              type: "remediation",
              controlId: ctrl.id,
              message: `✓ ${ctrl.practice} remediated — ${ctrl.remediationAction}`,
            });
            addActivity({
              type: "evidence",
              controlId: ctrl.id,
              message: `Evidence record written — timestamp, actor, action, before/after state captured for ${ctrl.practice} audit trail.`,
            });
          });
        });

        // Phase: compliant
        schedule(remOffset + 3500, () => {
          setPhase("compliant");
          addActivity({
            type: "system",
            message: "✓ All CMMC Level 2 controls restored. DefenseCore Solutions is fully compliant.",
          });
          addActivity({
            type: "system",
            message: "Compliance evidence package ready for CMMC C3PAO assessor export.",
          });
        });
      });
    },
    [reset, addActivity],
  );

  // Elapsed timer
  useEffect(() => {
    if (phase === "idle") return;
    const id = setInterval(() => {
      if (startTsRef.current) {
        setElapsedMs(Date.now() - startTsRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // Scroll activity feed
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity.length]);

  const score = phase === "idle" || phase === "baseline"
    ? BASELINE_SCORE
    : scoreAtPhase(controls);

  const failCount = controls.filter(
    (c) => c.status === "drifted" || c.status === "detecting" || c.status === "remediating",
  ).length;

  const fixedCount = controls.filter((c) => c.status === "fixed").length;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 15% 12%, rgba(0,229,255,0.07) 0%, transparent 40%), " +
          "radial-gradient(circle at 85% 8%, rgba(41,182,246,0.10) 0%, transparent 35%), " +
          "#07111f",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#fff",
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header
        style={{
          background: "#0d1e33",
          borderBottom: "1px solid rgba(41,182,246,0.25)",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "1rem 1.5rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          {/* Brand + title */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Image
              src="/logo.png"
              alt="SecureWatch360"
              width={120}
              height={64}
              priority
              style={{ height: 44, width: "auto", borderRadius: 6 }}
            />
            <span
              style={{
                width: 1,
                height: 20,
                background: "rgba(41,182,246,0.35)",
                display: "inline-block",
              }}
            />
            <h1
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600,
                fontSize: "0.95rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8ab4d4",
                margin: 0,
              }}
            >
              CMMC Level 2 — Compliance Recovery Demo
            </h1>
            <PhaseBadge phase={phase} />
          </div>

          {/* Client info */}
          <div style={{ display: "flex", gap: "2rem", fontSize: "0.8rem" }}>
            <InfoChip label="Client" value={CLIENT.name} />
            <InfoChip label="MSP" value={CLIENT.msp} />
            <InfoChip label="Framework" value={CLIENT.certificationLevel} />
            <InfoChip label="CUI Systems" value={String(CLIENT.cuiSystems)} />
          </div>
        </div>

        {/* Control bar */}
        <div
          style={{
            borderTop: "1px solid rgba(176,196,222,0.12)",
            background: "#07111f",
            padding: "0.75rem 1.5rem",
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <DemoButton
            onClick={() => void startDemo(1)}
            disabled={phase !== "idle" && phase !== "compliant"}
            variant="primary"
          >
            ▶ Start Simulation
          </DemoButton>
          <DemoButton
            onClick={() => void startDemo(3)}
            disabled={phase !== "idle" && phase !== "compliant"}
            variant="secondary"
          >
            ⚡ Run Fast (3×)
          </DemoButton>
          <DemoButton
            onClick={reset}
            disabled={phase === "idle"}
            variant="neutral"
          >
            ↺ Reset
          </DemoButton>

          <div style={{ marginLeft: "auto", display: "flex", gap: "1.5rem", fontSize: "0.78rem", color: "#8ab4d4" }}>
            {phase !== "idle" && (
              <span>
                Elapsed:{" "}
                <span style={{ color: "#29b6f6", fontVariantNumeric: "tabular-nums" }}>
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
                {speed > 1 && (
                  <span style={{ marginLeft: 4, color: "#00e5ff" }}>({speed}× speed)</span>
                )}
              </span>
            )}
            <span>
              Violations: <span style={{ color: failCount > 0 ? "#f87171" : "#22c55e", fontWeight: 600 }}>{failCount}</span>
            </span>
            <span>
              Remediated: <span style={{ color: fixedCount > 0 ? "#22c55e" : "#8ab4d4", fontWeight: 600 }}>{fixedCount}</span>
            </span>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Body — three columns                                                 */}
      {/* ------------------------------------------------------------------ */}
      <main
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "1.5rem",
          display: "grid",
          gridTemplateColumns: "280px 1fr 280px",
          gap: "1.25rem",
        }}
      >
        {/* ---- Left column ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Compliance score gauge */}
          <SWPanel title="CMMC Compliance Score">
            <ComplianceGauge score={score} phase={phase} />
          </SWPanel>

          {/* Client info */}
          <SWPanel title="Organization">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.8rem" }}>
              <OrgRow label="Client" value={CLIENT.name} />
              <OrgRow label="Contract" value={CLIENT.contract} />
              <OrgRow label="Certification" value={CLIENT.certificationLevel} />
              <OrgRow label="Last Assessment" value={CLIENT.lastAssessment} />
              <OrgRow label="CUI Systems" value={`${CLIENT.cuiSystems} in scope`} />
            </div>
          </SWPanel>

          {/* Domain coverage */}
          <SWPanel title="CMMC Domains">
            <DomainCoverage controls={controls} />
          </SWPanel>
        </div>

        {/* ---- Center column ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Idle / intro banner */}
          {phase === "idle" && (
            <IdleBanner onStart={() => void startDemo(1)} />
          )}

          {/* Controls list */}
          <SWPanel title="CMMC Level 2 Control Status">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {controls.map((ctrl) => (
                <ControlCard
                  key={ctrl.id}
                  control={ctrl}
                  selected={selectedControl?.id === ctrl.id}
                  onClick={() =>
                    setSelectedControl((prev) =>
                      prev?.id === ctrl.id ? null : ctrl,
                    )
                  }
                />
              ))}
            </div>
          </SWPanel>

          {/* Detail drawer */}
          {selectedControl && (
            <ControlDetailDrawer
              control={selectedControl}
              onClose={() => setSelectedControl(null)}
            />
          )}

          {/* Activity feed */}
          <SWPanel title="Live Activity Feed">
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {activity.length === 0 ? (
                <p style={{ color: "#8ab4d4", fontSize: "0.8rem", fontStyle: "italic" }}>
                  Start the simulation to see live events…
                </p>
              ) : (
                activity.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))
              )}
              <div ref={activityEndRef} />
            </div>
          </SWPanel>
        </div>

        {/* ---- Right column ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Agent status */}
          <SWPanel title="SecureWatch Agents">
            <AgentStatusPanel phase={phase} controls={controls} />
          </SWPanel>

          {/* Risk summary */}
          <SWPanel title="Risk Impact">
            <RiskImpactPanel phase={phase} controls={controls} />
          </SWPanel>

          {/* Evidence / report */}
          <SWPanel title="Compliance Evidence">
            <EvidencePanel phase={phase} fixedCount={fixedCount} />
          </SWPanel>

          {/* Compliant celebration */}
          {phase === "compliant" && <CompliantBanner />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SWPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        background: "#0d1e33",
        border: "1px solid rgba(41,182,246,0.2)",
        borderRadius: 12,
        padding: "1rem",
        boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#8ab4d4",
          marginBottom: "0.75rem",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: DemoPhase }): React.JSX.Element {
  const style: Record<
    DemoPhase,
    { bg: string; text: string; border: string }
  > = {
    idle: { bg: "rgba(176,196,222,0.1)", text: "#8ab4d4", border: "rgba(176,196,222,0.2)" },
    baseline: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", border: "rgba(34,197,94,0.3)" },
    drifting: { bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.35)" },
    detecting: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.35)" },
    remediating: { bg: "rgba(41,182,246,0.12)", text: "#29b6f6", border: "rgba(41,182,246,0.35)" },
    compliant: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.4)" },
  };
  const s = style[phase];
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        borderRadius: 9999,
        padding: "0.2rem 0.7rem",
        fontSize: "0.7rem",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {phaseLabel(phase)}
    </span>
  );
}

function InfoChip({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div>
      <span style={{ color: "#8ab4d4" }}>{label}: </span>
      <span style={{ color: "#fff", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function OrgRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
      <span style={{ color: "#8ab4d4" }}>{label}</span>
      <span style={{ color: "#e2e8f0", textAlign: "right", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function DemoButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "neutral";
  children: React.ReactNode;
}): React.JSX.Element {
  const styles: Record<
    typeof variant,
    { bg: string; text: string; border: string; hoverBg: string }
  > = {
    primary: {
      bg: "#1565c0",
      text: "#fff",
      border: "#1e88e5",
      hoverBg: "#1e88e5",
    },
    secondary: {
      bg: "rgba(0,229,255,0.1)",
      text: "#00e5ff",
      border: "rgba(0,229,255,0.4)",
      hoverBg: "rgba(0,229,255,0.18)",
    },
    neutral: {
      bg: "rgba(176,196,222,0.08)",
      text: "#b0c4de",
      border: "rgba(176,196,222,0.2)",
      hoverBg: "rgba(176,196,222,0.14)",
    },
  };
  const s = styles[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(176,196,222,0.05)" : s.bg,
        color: disabled ? "rgba(176,196,222,0.35)" : s.text,
        border: `1px solid ${disabled ? "rgba(176,196,222,0.12)" : s.border}`,
        borderRadius: 8,
        padding: "0.45rem 1rem",
        fontSize: "0.82rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Compliance gauge — animated SVG ring
// ---------------------------------------------------------------------------

function ComplianceGauge({
  score,
  phase,
}: {
  score: number;
  phase: DemoPhase;
}): React.JSX.Element {
  const r = 64;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  const ringColor =
    score >= 95
      ? "#22c55e"
      : score >= 80
        ? "#fbbf24"
        : "#f87171";

  const glowColor =
    score >= 95
      ? "rgba(34,197,94,0.4)"
      : score >= 80
        ? "rgba(251,191,36,0.35)"
        : "rgba(248,113,113,0.35)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0.5rem 0",
      }}
    >
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <svg
          width="160"
          height="160"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="rgba(176,196,222,0.12)"
            strokeWidth="10"
          />
          {/* Progress */}
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 0.8s ease, stroke 0.6s ease",
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "2.2rem",
              fontWeight: 700,
              color: ringColor,
              lineHeight: 1,
              transition: "color 0.6s ease",
            }}
          >
            {score}%
          </span>
          <span style={{ fontSize: "0.65rem", color: "#8ab4d4", marginTop: 2 }}>
            CMMC L2
          </span>
        </div>
      </div>
      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: ringColor,
          letterSpacing: "0.05em",
          transition: "color 0.6s ease",
        }}
      >
        {score === 100
          ? "✓ Fully Compliant"
          : score >= 95
            ? "Minor Drift"
            : score >= 80
              ? "Moderate Drift"
              : "Critical Violations"}
      </div>
      {phase === "remediating" && score < 100 && (
        <div
          style={{
            marginTop: "0.4rem",
            fontSize: "0.7rem",
            color: "#29b6f6",
          }}
        >
          Auto-remediation in progress…
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domain coverage mini-chart
// ---------------------------------------------------------------------------

function DomainCoverage({
  controls,
}: {
  controls: CmmcControl[];
}): React.JSX.Element {
  const domains = [
    ...new Set(controls.map((c) => c.domain)),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {domains.map((domain) => {
        const inDomain = controls.filter((c) => c.domain === domain);
        const passing = inDomain.filter(
          (c) => c.status === "pass" || c.status === "fixed",
        ).length;
        const pct = Math.round((passing / inDomain.length) * 100);
        const barColor =
          pct === 100 ? "#22c55e" : pct === 0 ? "#f87171" : "#fbbf24";
        return (
          <div key={domain}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.72rem",
                marginBottom: "0.2rem",
              }}
            >
              <span style={{ color: "#b0c4de" }}>{domain}</span>
              <span style={{ color: barColor, fontWeight: 600 }}>{pct}%</span>
            </div>
            <div
              style={{
                height: 5,
                background: "rgba(176,196,222,0.1)",
                borderRadius: 9999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: barColor,
                  borderRadius: 9999,
                  transition: "width 0.7s ease, background 0.5s ease",
                  boxShadow: `0 0 6px ${barColor}66`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Control card
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ControlStatus,
  { label: string; dot: string; border: string; bg: string }
> = {
  pass: { label: "PASS", dot: "#22c55e", border: "rgba(34,197,94,0.2)", bg: "rgba(34,197,94,0.06)" },
  drifted: { label: "VIOLATION", dot: "#f87171", border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.08)" },
  detecting: { label: "ANALYZING", dot: "#fbbf24", border: "rgba(251,191,36,0.35)", bg: "rgba(251,191,36,0.07)" },
  remediating: { label: "REMEDIATING", dot: "#29b6f6", border: "rgba(41,182,246,0.35)", bg: "rgba(41,182,246,0.07)" },
  fixed: { label: "FIXED", dot: "#22c55e", border: "rgba(34,197,94,0.3)", bg: "rgba(34,197,94,0.08)" },
};

const SEVERITY_COLORS: Record<CmmcControl["severity"], string> = {
  critical: "#f87171",
  high: "#fb923c",
  medium: "#fbbf24",
};

function ControlCard({
  control,
  selected,
  onClick,
}: {
  control: CmmcControl;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const sc = STATUS_CONFIG[control.status];
  const isAnimating =
    control.status === "detecting" || control.status === "remediating";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: selected ? "rgba(41,182,246,0.08)" : sc.bg,
        border: `1px solid ${selected ? "rgba(41,182,246,0.5)" : sc.border}`,
        borderRadius: 10,
        padding: "0.75rem 1rem",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        {/* Status dot */}
        <div style={{ paddingTop: 3 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: sc.dot,
              flexShrink: 0,
              boxShadow: `0 0 8px ${sc.dot}88`,
              animation: isAnimating ? "sw360-pulse 1.2s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: "0.82rem",
                color: "#29b6f6",
                letterSpacing: "0.04em",
              }}
            >
              {control.practice}
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                background: "rgba(176,196,222,0.1)",
                color: "#8ab4d4",
                borderRadius: 4,
                padding: "0.1rem 0.4rem",
              }}
            >
              {control.domain}
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                color: SEVERITY_COLORS[control.severity],
                fontWeight: 600,
                marginLeft: "auto",
              }}
            >
              {control.severity.toUpperCase()}
            </span>
          </div>

          <div
            style={{
              marginTop: "0.25rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            {control.title}
          </div>

          {control.status !== "pass" && (
            <div
              style={{
                marginTop: "0.35rem",
                fontSize: "0.75rem",
                color: "#8ab4d4",
                lineHeight: 1.4,
              }}
            >
              {control.status === "fixed"
                ? control.remediationAction
                : control.violation}
            </div>
          )}
        </div>

        {/* Status badge */}
        <span
          style={{
            flexShrink: 0,
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: sc.dot,
            border: `1px solid ${sc.border}`,
            borderRadius: 6,
            padding: "0.15rem 0.5rem",
            background: sc.bg,
          }}
        >
          {sc.label}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Control detail drawer
// ---------------------------------------------------------------------------

function ControlDetailDrawer({
  control,
  onClose,
}: {
  control: CmmcControl;
  onClose: () => void;
}): React.JSX.Element {
  const sc = STATUS_CONFIG[control.status];
  return (
    <div
      style={{
        background: "#112d4e",
        border: "1px solid rgba(41,182,246,0.3)",
        borderRadius: 12,
        padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              color: "#29b6f6",
              letterSpacing: "0.04em",
            }}
          >
            {control.practice} — {control.title}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#8ab4d4", marginTop: 2 }}>
            {control.domain} · Severity:{" "}
            <span style={{ color: SEVERITY_COLORS[control.severity], fontWeight: 600 }}>
              {control.severity}
            </span>{" "}
            · Status:{" "}
            <span style={{ color: sc.dot, fontWeight: 600 }}>{sc.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#8ab4d4",
            cursor: "pointer",
            fontSize: "1.1rem",
            padding: "0.25rem",
          }}
        >
          ✕
        </button>
      </div>

      <Section label="Requirement">{control.description}</Section>

      {control.status !== "pass" && (
        <>
          <Section label="Violation Detected">{control.violation}</Section>
          <Section label="Agent Reasoning">{control.agentReasoning}</Section>
          <Section label="Remediation Action">{control.remediationAction}</Section>
        </>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#8ab4d4",
          marginBottom: "0.35rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity feed row
// ---------------------------------------------------------------------------

const ACTIVITY_COLORS: Record<ActivityEntry["type"], string> = {
  system: "#8ab4d4",
  drift: "#f87171",
  detection: "#fbbf24",
  remediation: "#22c55e",
  evidence: "#29b6f6",
};

function ActivityRow({ entry }: { entry: ActivityEntry }): React.JSX.Element {
  const color = ACTIVITY_COLORS[entry.type];
  const prefix: Record<ActivityEntry["type"], string> = {
    system: "SYS",
    drift: "DRIFT",
    detection: "AGENT",
    remediation: "FIX",
    evidence: "EVID",
  };
  return (
    <div
      style={{
        display: "flex",
        gap: "0.6rem",
        fontSize: "0.75rem",
        lineHeight: 1.45,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontWeight: 700,
          fontSize: "0.65rem",
          letterSpacing: "0.07em",
          color,
          minWidth: 40,
          paddingTop: 1,
        }}
      >
        {prefix[entry.type]}
      </span>
      <span style={{ color: "#cbd5e1" }}>{entry.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent status panel
// ---------------------------------------------------------------------------

const AGENTS = [
  { id: 1, name: "Agent 1 — Discovery", domain: "IA" },
  { id: 2, name: "Agent 2 — Access Control", domain: "AC" },
  { id: 3, name: "Agent 3 — Compliance", domain: "SC / AU" },
  { id: 4, name: "Agent 4 — Config Mgmt", domain: "CM" },
  { id: 5, name: "Agent 5 — Audit", domain: "AU" },
];

function AgentStatusPanel({
  phase,
  controls,
}: {
  phase: DemoPhase;
  controls: CmmcControl[];
}): React.JSX.Element {
  const active = phase === "detecting" || phase === "remediating";
  const complete = phase === "compliant";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {AGENTS.map((agent) => {
        const relevantCtrl = controls.find(
          (c) => c.status === "detecting" || c.status === "remediating",
        );
        const isActive =
          active &&
          relevantCtrl !== undefined;
        const isDone = complete || (phase === "remediating" && controls.every(c => c.status === "fixed" || c.status === "pass"));

        return (
          <div
            key={agent.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: "0.75rem",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isDone ? "#22c55e" : isActive ? "#29b6f6" : "#8ab4d4",
                boxShadow: isActive ? "0 0 6px #29b6f688" : "none",
                animation: isActive ? "sw360-pulse 1.2s ease-in-out infinite" : "none",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#b0c4de", flex: 1 }}>{agent.name}</span>
            <span
              style={{
                fontSize: "0.65rem",
                color: isDone ? "#22c55e" : isActive ? "#29b6f6" : "#8ab4d4",
                fontWeight: 600,
              }}
            >
              {isDone ? "Done" : isActive ? "Active" : "Standby"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk impact panel
// ---------------------------------------------------------------------------

function RiskImpactPanel({
  phase,
  controls,
}: {
  phase: DemoPhase;
  controls: CmmcControl[];
}): React.JSX.Element {
  const violations = controls.filter(
    (c) => c.status === "drifted" || c.status === "detecting",
  );
  const criticalCount = violations.filter((c) => c.severity === "critical").length;
  const highCount = violations.filter((c) => c.severity === "high").length;
  const mediumCount = violations.filter((c) => c.severity === "medium").length;

  const contractRisk =
    criticalCount >= 2
      ? "CONTRACT AT RISK"
      : criticalCount === 1
        ? "ELEVATED"
        : violations.length > 0
          ? "MODERATE"
          : "CLEARED";

  const contractColor =
    contractRisk === "CONTRACT AT RISK"
      ? "#f87171"
      : contractRisk === "ELEVATED"
        ? "#fb923c"
        : contractRisk === "MODERATE"
          ? "#fbbf24"
          : "#22c55e";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.78rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>DoD Contract Risk</span>
        <span style={{ color: contractColor, fontWeight: 700 }}>{contractRisk}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>Critical violations</span>
        <span style={{ color: criticalCount > 0 ? "#f87171" : "#22c55e", fontWeight: 600 }}>
          {criticalCount}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>High violations</span>
        <span style={{ color: highCount > 0 ? "#fb923c" : "#22c55e", fontWeight: 600 }}>
          {highCount}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>Medium violations</span>
        <span style={{ color: mediumCount > 0 ? "#fbbf24" : "#22c55e", fontWeight: 600 }}>
          {mediumCount}
        </span>
      </div>
      {phase === "drifting" || phase === "detecting" ? (
        <div
          style={{
            marginTop: "0.25rem",
            padding: "0.5rem 0.75rem",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: 8,
            fontSize: "0.72rem",
            color: "#fca5a5",
            lineHeight: 1.4,
          }}
        >
          ⚠ DARPA contract CMMC attestation due in 23 days. Unresolved critical violations
          may result in contract suspension.
        </div>
      ) : phase === "compliant" ? (
        <div
          style={{
            marginTop: "0.25rem",
            padding: "0.5rem 0.75rem",
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 8,
            fontSize: "0.72rem",
            color: "#86efac",
            lineHeight: 1.4,
          }}
        >
          ✓ All violations resolved. Contract attestation cleared.
          Auto-generated evidence package available.
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence panel
// ---------------------------------------------------------------------------

function EvidencePanel({
  phase,
  fixedCount,
}: {
  phase: DemoPhase;
  fixedCount: number;
}): React.JSX.Element {
  const records = fixedCount;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.78rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>Evidence records</span>
        <span style={{ color: "#29b6f6", fontWeight: 700 }}>{records}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>Audit trail</span>
        <span style={{ color: records > 0 ? "#22c55e" : "#8ab4d4", fontWeight: 600 }}>
          {records > 0 ? "Active" : "Waiting"}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#8ab4d4" }}>C3PAO export</span>
        <span
          style={{
            color: phase === "compliant" ? "#22c55e" : "#8ab4d4",
            fontWeight: 600,
          }}
        >
          {phase === "compliant" ? "Ready" : "Pending"}
        </span>
      </div>
      {phase === "compliant" && (
        <div
          style={{
            marginTop: "0.25rem",
            padding: "0.5rem 0.75rem",
            background: "rgba(41,182,246,0.08)",
            border: "1px solid rgba(41,182,246,0.25)",
            borderRadius: 8,
            fontSize: "0.72rem",
            color: "#93c5fd",
          }}
        >
          Compliance evidence package generated with tamper-proof timestamps,
          actor IDs, and before/after state for all 5 remediated controls.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Idle banner
// ---------------------------------------------------------------------------

function IdleBanner({
  onStart,
}: {
  onStart: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(21,101,192,0.18) 0%, rgba(0,229,255,0.06) 100%)",
        border: "1px solid rgba(41,182,246,0.3)",
        borderRadius: 14,
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "#29b6f6",
          marginBottom: "0.5rem",
        }}
      >
        CMMC Level 2 — Compliance Recovery Demo
      </div>
      <p style={{ color: "#8ab4d4", fontSize: "0.85rem", maxWidth: 480, margin: "0 auto 1.5rem" }}>
        Watch SecureWatch360 detect five CMMC Level 2 control violations in a live DoD contractor
        environment, then autonomously remediate each one — returning to full compliance
        with a complete audit evidence package in under 60 seconds.
      </p>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        {["AC.1.001", "SC.3.177", "AU.2.042", "IA.3.083", "CM.2.061"].map((id) => (
          <span
            key={id}
            style={{
              background: "rgba(41,182,246,0.1)",
              border: "1px solid rgba(41,182,246,0.25)",
              borderRadius: 6,
              padding: "0.25rem 0.6rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "#29b6f6",
              letterSpacing: "0.05em",
            }}
          >
            {id}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          background: "linear-gradient(135deg, #1565c0, #1e88e5)",
          color: "#fff",
          border: "none",
          borderRadius: 9,
          padding: "0.65rem 2rem",
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.03em",
          boxShadow: "0 4px 20px rgba(21,101,192,0.45)",
        }}
      >
        ▶ Start Simulation
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliant celebration banner
// ---------------------------------------------------------------------------

function CompliantBanner(): React.JSX.Element {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(0,229,255,0.07) 100%)",
        border: "1px solid rgba(34,197,94,0.4)",
        borderRadius: 12,
        padding: "1.25rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: "1.6rem",
          fontWeight: 700,
          color: "#22c55e",
          marginBottom: "0.4rem",
        }}
      >
        ✓ FULLY COMPLIANT
      </div>
      <div style={{ fontSize: "0.78rem", color: "#86efac", lineHeight: 1.5 }}>
        All 5 CMMC Level 2 controls restored.
        <br />
        Evidence package ready for C3PAO assessment.
        <br />
        Mean time to remediate: &lt; 60 seconds.
      </div>
    </div>
  );
}

/*
 * Keyframe animation injected as a global style tag.
 * This avoids a Tailwind/CSS-modules dependency for the pulse effect.
 */
const PULSE_KEYFRAMES = `
@keyframes sw360-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.88); }
}
`;

// Inject once on first render
if (typeof document !== "undefined") {
  const styleId = "sw360-cmmc-demo-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = PULSE_KEYFRAMES;
    document.head.appendChild(style);
  }
}
