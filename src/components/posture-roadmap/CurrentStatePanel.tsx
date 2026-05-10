"use client";

import type { PostureCurrentState } from "@/types/posture-roadmap";

interface Props {
  data: PostureCurrentState;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#60a5fa",
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
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(176,196,222,0.15)" strokeWidth="10" />
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
        <text x="64" y="60" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700" fontFamily="Inter,sans-serif">
          {score}
        </text>
        <text x="64" y="78" textAnchor="middle" fill="#8ab4d4" fontSize="11" fontFamily="Inter,sans-serif">
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
  color = "#8ab4d4",
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
        border: "1px solid rgba(176,196,222,0.18)",
      }}
    >
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8ab4d4" }}>
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color }}>
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: "#8ab4d4" }}>{sub}</span>}
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
        <span className="text-sm font-medium" style={{ color: "#e6edf5" }}>
          {displayName}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
          {readinessPercent}%
          {!met && (
            <span className="ml-1.5 text-xs font-normal" style={{ color: "#8ab4d4" }}>
              (need {requiredMaturityScore}%)
            </span>
          )}
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-visible" style={{ background: "rgba(176,196,222,0.12)" }}>
        <div
          className="h-2 rounded-full"
          style={{
            width: `${readinessPercent}%`,
            background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
            transition: "width 0.8s ease",
          }}
        />
        {/* Required threshold marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4"
          style={{
            left: reqPosition,
            background: "rgba(255,255,255,0.5)",
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
        className="rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.2)",
        }}
      >
        <MaturityRing score={data.maturityScore} label={data.maturityLabel} />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
          <StatCard
            label="Unresolved Findings"
            value={data.unresolvedFindingsCount}
            color="#f97316"
          />
          <StatCard
            label="Critical Findings"
            value={data.criticalFindingsCount}
            color="#ef4444"
          />
          <StatCard
            label="High Findings"
            value={data.highFindingsCount}
            color="#f97316"
          />
          <StatCard
            label="Missing Controls"
            value={data.missingControlsCount}
            color="#eab308"
            sub="no finding mapped"
          />
          <StatCard
            label="Exposed Assets"
            value={data.exposedAssetsCount}
            color="#ef4444"
            sub="internet/external"
          />
          <StatCard
            label="Identity Gaps"
            value={data.identityGapsCount}
            color="#a78bfa"
            sub="IAM findings open"
          />
        </div>
      </div>

      {/* Framework readiness */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.2)",
        }}
      >
        <div>
          <p className="sw-kicker mb-1">Framework Readiness</p>
          <p className="text-xs" style={{ color: "#8ab4d4" }}>
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
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
            border: "1px solid rgba(41,182,246,0.2)",
          }}
        >
          <p className="sw-kicker mb-4">Top Risks</p>
          <div className="space-y-2">
            {data.topRisks.map((risk) => (
              <div
                key={risk.findingId}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: "rgba(176,196,222,0.06)", border: "1px solid rgba(176,196,222,0.1)" }}
              >
                <span
                  className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: `${SEVERITY_COLORS[risk.severity] ?? "#8ab4d4"}22`,
                    color: SEVERITY_COLORS[risk.severity] ?? "#8ab4d4",
                    border: `1px solid ${SEVERITY_COLORS[risk.severity] ?? "#8ab4d4"}44`,
                  }}
                >
                  {risk.severity}
                </span>
                <span className="text-sm font-medium flex-1 truncate" style={{ color: "#e6edf5" }}>
                  {risk.title}
                </span>
                <span className="text-xs shrink-0" style={{ color: "#8ab4d4" }}>
                  {risk.category ?? risk.assetType}
                </span>
                <span
                  className="text-xs font-mono tabular-nums shrink-0"
                  style={{ color: "#8ab4d4" }}
                >
                  P{risk.priorityScore}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
