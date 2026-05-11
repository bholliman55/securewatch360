"use client";

import { Lock, Server, Globe, Bug, Database, Activity, ClipboardCheck, GraduationCap, AlertTriangle } from "lucide-react";
import type { PostureCurrentState } from "@/types/posture-roadmap";

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
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
      }}
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color }}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">
          {displayName}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
          {readinessPercent}%
          {!met && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              (need {requiredMaturityScore}%)
            </span>
          )}
        </span>
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
          style={{
            left: reqPosition,
            background: "rgba(255,255,255,0.4)",
            borderRadius: "1px",
          }}
          title={`Required: ${requiredMaturityScore}%`}
        />
      </div>
    </div>
  );
}

export function CurrentStatePanel({ data }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header row: maturity ring + key stats */}
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.25)",
          borderLeft: "4px solid #667eea",
        }}
      >
        <MaturityRing score={data.maturityScore} label={data.maturityLabel} />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
          <StatCard label="Unresolved Findings" value={data.unresolvedFindingsCount} color="#f97316" />
          <StatCard label="Critical Findings"   value={data.criticalFindingsCount}   color="#ef4444" />
          <StatCard label="High Findings"        value={data.highFindingsCount}        color="#f97316" />
          <StatCard label="Missing Controls"     value={data.missingControlsCount}     color="#eab308" sub="no finding mapped" />
          <StatCard label="Exposed Assets"       value={data.exposedAssetsCount}       color="#ef4444" sub="internet/external" />
          <StatCard label="Identity Gaps"        value={data.identityGapsCount}        color="#8b5cf6" sub="IAM findings open" />
        </div>
      </div>

      {/* Framework readiness */}
      <div
        className="rounded-2xl p-6 space-y-4 shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.2)",
        }}
      >
        <div>
          <p className="sw-kicker mb-1">Framework Readiness</p>
          <p className="text-xs text-slate-400">
            Dashed line shows required threshold for certification readiness
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
          className="rounded-2xl p-6 shadow-lg"
          style={{
            background: "#1e293b",
            border: "1px solid rgba(102,126,234,0.2)",
          }}
        >
          <p className="sw-kicker mb-4">Top Risks</p>
          <div className="space-y-2">
            {data.topRisks.map((risk) => {
              const CategoryIcon = CATEGORY_ICONS[risk.category ?? ""] ?? AlertTriangle;
              return (
                <div
                  key={risk.findingId}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: "rgba(102,126,234,0.06)", border: "1px solid #334155" }}
                >
                  <span
                    className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: `${SEVERITY_COLORS[risk.severity] ?? "#94a3b8"}22`,
                      color: SEVERITY_COLORS[risk.severity] ?? "#94a3b8",
                      border: `1px solid ${SEVERITY_COLORS[risk.severity] ?? "#94a3b8"}44`,
                    }}
                  >
                    {risk.severity}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate text-slate-100">
                    {risk.title}
                  </span>
                  <CategoryIcon size={14} className="shrink-0 text-slate-400" />
                  <span className="text-xs shrink-0 text-slate-400">
                    {risk.category ?? risk.assetType}
                  </span>
                  <span className="text-xs font-mono tabular-nums shrink-0 text-slate-400">
                    P{risk.priorityScore}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
