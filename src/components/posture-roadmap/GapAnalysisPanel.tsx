"use client";

import { Lock, Server, Globe, Bug, Database, Activity, ClipboardCheck, GraduationCap, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import type { GapItem } from "@/types/posture-roadmap";

interface Props {
  gaps: GapItem[];
}

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

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "#ef444422", color: "#ef4444", border: "#ef444444" },
  high:     { bg: "#f9731622", color: "#f97316", border: "#f9731644" },
  medium:   { bg: "#eab30822", color: "#eab308", border: "#eab30844" },
  low:      { bg: "#3b82f622", color: "#3b82f6", border: "#3b82f644" },
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
  const CategoryIcon = CATEGORY_ICONS[gap.category] ?? AlertTriangle;
  const hasCritical = gap.criticalCount > 0;
  const hasHigh = gap.highCount > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-lg"
      style={{
        background: "#1e293b",
        border: `1px solid ${hasCritical ? "rgba(239,68,68,0.4)" : hasHigh ? "rgba(249,115,22,0.3)" : "#334155"}`,
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
            : "rgba(102,126,234,0.06)",
          borderBottom: "1px solid #334155",
          borderLeft: `4px solid ${hasCritical ? "#ef4444" : hasHigh ? "#f97316" : "#667eea"}`,
        }}
      >
        <CategoryIcon size={18} className={hasCritical ? "text-red-400" : hasHigh ? "text-orange-400" : "text-violet-400"} />
        <div className="flex-1">
          <p className="font-semibold text-slate-100">
            {gap.categoryLabel}
          </p>
          <p className="text-xs text-slate-400">
            {gap.gapCount} gap{gap.gapCount !== 1 ? "s" : ""}
            {gap.criticalCount > 0 && (
              <span className="text-red-400"> · {gap.criticalCount} critical</span>
            )}
            {gap.highCount > 0 && (
              <span className="text-orange-400"> · {gap.highCount} high</span>
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
      <div className="divide-y" style={{ borderColor: "#334155" }}>
        {gap.items.map((item) => (
          <div key={item.id} className="px-5 py-3.5 flex items-start gap-3">
            <PriorityBadge priority={item.priority} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-100">
                {item.title}
              </p>
              {item.current_state && (
                <p className="text-xs mt-0.5 truncate text-slate-400">
                  Now: {item.current_state}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.related_framework && (
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(102,126,234,0.15)", color: "#a78bfa" }}
                >
                  {item.related_framework}
                </span>
              )}
              {item.automation_level === "now" && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}
                  title="SecureWatch360 can automate this now"
                >
                  <Zap size={10} />
                  Auto
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
      <div
        className="text-center py-16 rounded-2xl shadow-lg"
        style={{ background: "#1e293b", border: "1px solid #334155" }}
      >
        <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
        <p className="text-lg font-semibold text-slate-100">No gaps found</p>
        <p className="text-sm text-slate-400 mt-1">Your roadmap is empty — either all items are completed or none have been seeded yet.</p>
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
        className="rounded-2xl px-6 py-4 flex flex-wrap gap-6 items-center shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.2)",
          borderLeft: "4px solid #667eea",
        }}
      >
        <div>
          <p className="sw-kicker">Gap Analysis Summary</p>
          <p className="text-xs mt-0.5 text-slate-400">Grouped by security domain</p>
        </div>
        <div className="flex gap-5 ml-auto">
          {[
            { label: "Total Gaps",  value: totalGaps,     color: "#94a3b8" },
            { label: "Critical",    value: totalCritical,  color: "#ef4444" },
            { label: "High",        value: totalHigh,      color: "#f97316" },
            { label: "Domains",     value: gaps.length,    color: "#a78bfa" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
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
