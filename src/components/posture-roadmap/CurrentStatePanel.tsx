"use client";

import { useState } from "react";
import { Lock, Server, Globe, Bug, Database, Activity, ClipboardCheck, GraduationCap, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { PostureCurrentState } from "@/types/posture-roadmap";
import { ROADMAP_CATEGORY_LABELS } from "@/types/posture-roadmap";

interface Props {
  data: PostureCurrentState;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#8b5cf6",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  identity_access: Lock,
  endpoint_security: Server,
  network_security: Globe,
  vulnerability_management: Bug,
  backup_recovery: Database,
  monitoring_logging: Activity,
  compliance_evidence: ClipboardCheck,
  security_awareness: GraduationCap,
  incident_response: AlertTriangle,
};

function MaturityRing({ score, label }: { score: number; label: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  const color =
    score >= 70 ? "#22c55e" : score >= 50 ? "#eab308" : score >= 30 ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(102,126,234,0.15)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="64" y="60" textAnchor="middle" fill="#f1f5f9" fontSize="26" fontWeight="700" fontFamily="Inter,sans-serif">
          {score}
        </text>
        <text x="64" y="78" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="Inter,sans-serif">
          / 100
        </text>
      </svg>
      <span
        className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
      >
        {label}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "#94a3b8",
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1 shadow-lg"
      style={{ background: "#1e293b", border: "1px solid #334155" }}
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

function FrameworkBar({
  displayName,
  readinessPercent,
  requiredMaturityScore,
}: {
  displayName: string;
  readinessPercent: number;
  requiredMaturityScore: number;
}) {
  const met = readinessPercent >= requiredMaturityScore;
  const barColor = met ? "#22c55e" : readinessPercent >= requiredMaturityScore * 0.75 ? "#eab308" : "#ef4444";
  const reqPosition = `${requiredMaturityScore}%`;
  const statusLabel = met ? "Ready" : readinessPercent >= requiredMaturityScore * 0.75 ? "Close" : "Gap";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-100">{displayName}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `${barColor}18`,
              color: barColor,
              border: `1px solid ${barColor}44`,
            }}
          >
            {statusLabel}
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
            {readinessPercent}%
            {!met && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                / {requiredMaturityScore}% needed
              </span>
            )}
          </span>
        </div>
      </div>
      <div className="relative h-2 rounded-full overflow-visible" style={{ background: "rgba(102,126,234,0.12)" }}>
        <div
          className="h-2 rounded-full"
          style={{
            width: `${readinessPercent}%`,
            background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
            transition: "width 0.8s ease",
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4"
          style={{ left: reqPosition, background: "rgba(255,255,255,0.35)", borderRadius: "1px" }}
          title={`Certification threshold: ${requiredMaturityScore}%`}
        />
      </div>
    </div>
  );
}

export function CurrentStatePanel({ data }: Props) {
  const [showAllRisks, setShowAllRisks] = useState(false);
  const visibleRisks = showAllRisks ? data.topRisks : data.topRisks.slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header row: maturity ring + key stats */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.25)",
          borderLeft: "4px solid #667eea",
        }}
      >
        <MaturityRing score={data.maturityScore} label={data.maturityLabel} />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
          <StatCard
            label="Open Findings"
            value={data.unresolvedFindingsCount}
            color="#f97316"
            sub="require remediation"
          />
          <StatCard
            label="Critical"
            value={data.criticalFindingsCount}
            color="#ef4444"
            sub="act immediately"
          />
          <StatCard
            label="High"
            value={data.highFindingsCount}
            color="#f97316"
            sub="same-day response"
          />
          <StatCard
            label="Control Gaps"
            value={data.missingControlsCount}
            color="#eab308"
            sub="not yet addressed"
          />
          <StatCard
            label="Exposed Assets"
            value={data.exposedAssetsCount}
            color="#ef4444"
            sub="internet-facing risk"
          />
          <StatCard
            label="Identity Gaps"
            value={data.identityGapsCount}
            color="#8b5cf6"
            sub="access control issues"
          />
        </div>
      </div>

      {/* Framework readiness */}
      <div
        className="rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg"
        style={{ background: "#1e293b", border: "1px solid rgba(102,126,234,0.2)" }}
      >
        <div>
          <p className="sw-kicker mb-1">Framework Readiness</p>
          <p className="text-xs text-slate-400">
            How your current posture maps to each compliance framework.
            The marker shows the certification threshold.
          </p>
        </div>
        <div className="space-y-4">
          {data.frameworkReadiness.map((fw) => (
            <FrameworkBar key={fw.framework} {...fw} />
          ))}
        </div>
      </div>

      {/* Top risks */}
      {data.topRisks.length > 0 && (
        <div
          className="rounded-2xl p-5 sm:p-6 shadow-lg"
          style={{ background: "#1e293b", border: "1px solid rgba(102,126,234,0.2)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="sw-kicker mb-0.5">Priority Risks</p>
              <p className="text-xs text-slate-400">
                Top findings by severity and business impact
              </p>
            </div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              {data.topRisks.length} open
            </span>
          </div>

          <div className="space-y-2">
            {visibleRisks.map((risk) => {
              const CategoryIcon = CATEGORY_ICONS[risk.category ?? ""] ?? AlertTriangle;
              const catLabel =
                risk.category && ROADMAP_CATEGORY_LABELS[risk.category as keyof typeof ROADMAP_CATEGORY_LABELS]
                  ? ROADMAP_CATEGORY_LABELS[risk.category as keyof typeof ROADMAP_CATEGORY_LABELS]
                  : risk.assetType;

              return (
                <div
                  key={risk.findingId}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: "rgba(102,126,234,0.06)", border: "1px solid #334155" }}
                >
                  <span
                    className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                    style={{
                      background: `${SEVERITY_COLORS[risk.severity] ?? "#94a3b8"}22`,
                      color: SEVERITY_COLORS[risk.severity] ?? "#94a3b8",
                      border: `1px solid ${SEVERITY_COLORS[risk.severity] ?? "#94a3b8"}44`,
                    }}
                  >
                    {SEVERITY_LABELS[risk.severity] ?? risk.severity}
                  </span>
                  <span className="text-sm font-medium flex-1 min-w-0 text-slate-100 leading-snug">
                    {risk.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 self-start mt-0.5">
                    <CategoryIcon size={13} className="text-slate-500" />
                    <span className="text-xs text-slate-500 hidden sm:inline">{catLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {data.topRisks.length > 3 && (
            <button
              onClick={() => setShowAllRisks((v) => !v)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-slate-700/50"
              style={{ color: "#94a3b8", border: "1px solid #334155" }}
            >
              {showAllRisks ? (
                <><ChevronUp size={13} /> Show less</>
              ) : (
                <><ChevronDown size={13} /> Show {data.topRisks.length - 3} more risks</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
