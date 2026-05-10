"use client";

import type { GapItem } from "@/types/posture-roadmap";

interface Props {
  gaps: GapItem[];
}

const CATEGORY_ICONS: Record<string, string> = {
  identity_access: "🔐",
  endpoint_security: "💻",
  network_security: "🌐",
  vulnerability_management: "🔍",
  backup_recovery: "💾",
  monitoring_logging: "📊",
  compliance_evidence: "📋",
  security_awareness: "🎓",
  incident_response: "🚨",
};

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "#ef444422", color: "#ef4444", border: "#ef444444" },
  high: { bg: "#f9731622", color: "#f97316", border: "#f9731644" },
  medium: { bg: "#eab30822", color: "#eab308", border: "#eab30844" },
  low: { bg: "#22c55e22", color: "#22c55e", border: "#22c55e44" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {priority}
    </span>
  );
}

function CategoryCard({ gap }: { gap: GapItem }) {
  const icon = CATEGORY_ICONS[gap.category] ?? "⚙️";
  const hasCritical = gap.criticalCount > 0;
  const hasHigh = gap.highCount > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
        border: `1px solid ${hasCritical ? "rgba(239,68,68,0.35)" : hasHigh ? "rgba(249,115,22,0.3)" : "rgba(176,196,222,0.18)"}`,
      }}
    >
      {/* Category header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{
          background: hasCritical
            ? "rgba(239,68,68,0.08)"
            : hasHigh
            ? "rgba(249,115,22,0.06)"
            : "rgba(176,196,222,0.05)",
          borderBottom: "1px solid rgba(176,196,222,0.1)",
        }}
      >
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold" style={{ color: "#e6edf5" }}>
            {gap.categoryLabel}
          </p>
          <p className="text-xs" style={{ color: "#8ab4d4" }}>
            {gap.gapCount} gap{gap.gapCount !== 1 ? "s" : ""}
            {gap.criticalCount > 0 && (
              <span style={{ color: "#ef4444" }}> · {gap.criticalCount} critical</span>
            )}
            {gap.highCount > 0 && (
              <span style={{ color: "#f97316" }}> · {gap.highCount} high</span>
            )}
          </p>
        </div>
        <div className="flex gap-1.5">
          {gap.criticalCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }}
            >
              {gap.criticalCount}C
            </span>
          )}
          {gap.highCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#f9731622", color: "#f97316", border: "1px solid #f9731644" }}
            >
              {gap.highCount}H
            </span>
          )}
        </div>
      </div>

      {/* Gap items */}
      <div className="divide-y" style={{ borderColor: "rgba(176,196,222,0.08)" }}>
        {gap.items.map((item) => (
          <div key={item.id} className="px-5 py-3.5 flex items-start gap-3">
            <PriorityBadge priority={item.priority} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "#e6edf5" }}>
                {item.title}
              </p>
              {item.current_state && (
                <p className="text-xs mt-0.5 truncate" style={{ color: "#8ab4d4" }}>
                  Now: {item.current_state}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.related_framework && (
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(41,182,246,0.12)", color: "#29b6f6" }}
                >
                  {item.related_framework}
                </span>
              )}
              {item.automation_level === "now" && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}
                  title="SecureWatch360 can automate this now"
                >
                  ⚡ Auto
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GapAnalysisPanel({ gaps }: Props) {
  if (gaps.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "#8ab4d4" }}>
        <p className="text-4xl mb-3">✅</p>
        <p className="text-lg font-semibold" style={{ color: "#e6edf5" }}>
          No gaps found
        </p>
        <p className="text-sm">Your roadmap is empty — either all items are completed or none have been seeded yet.</p>
      </div>
    );
  }

  const totalGaps = gaps.reduce((sum, g) => sum + g.gapCount, 0);
  const totalCritical = gaps.reduce((sum, g) => sum + g.criticalCount, 0);
  const totalHigh = gaps.reduce((sum, g) => sum + g.highCount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary bar */}
      <div
        className="rounded-2xl px-6 py-4 flex flex-wrap gap-6 items-center"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.2)",
        }}
      >
        <div>
          <p className="sw-kicker">Gap Analysis Summary</p>
          <p className="text-xs mt-0.5" style={{ color: "#8ab4d4" }}>
            Grouped by security domain
          </p>
        </div>
        <div className="flex gap-5 ml-auto">
          {[
            { label: "Total Gaps", value: totalGaps, color: "#8ab4d4" },
            { label: "Critical", value: totalCritical, color: "#ef4444" },
            { label: "High", value: totalHigh, color: "#f97316" },
            { label: "Domains", value: gaps.length, color: "#29b6f6" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs" style={{ color: "#8ab4d4" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category cards — critical/high categories first */}
      <div className="space-y-4">
        {[...gaps]
          .sort((a, b) => b.criticalCount * 10 + b.highCount - (a.criticalCount * 10 + a.highCount))
          .map((gap) => (
            <CategoryCard key={gap.category} gap={gap} />
          ))}
      </div>
    </div>
  );
}
