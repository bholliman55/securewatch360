"use client";

import { useState } from "react";
import {
  Lock, Server, Globe, Bug, Database, Activity,
  ClipboardCheck, GraduationCap, AlertTriangle, CheckCircle,
  Zap, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
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

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  critical: { bg: "#ef444422", color: "#ef4444", border: "#ef444444", label: "Critical" },
  high:     { bg: "#f9731622", color: "#f97316", border: "#f9731644", label: "High"     },
  medium:   { bg: "#eab30822", color: "#eab308", border: "#eab30844", label: "Medium"   },
  low:      { bg: "#3b82f622", color: "#3b82f6", border: "#3b82f644", label: "Low"      },
};

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function GapItemRow({ item }: { item: GapItem["items"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(item.current_state || item.desired_state || item.recommended_action);

  return (
    <div className="border-b last:border-0" style={{ borderColor: "#334155" }}>
      {/* Summary row */}
      <div className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
        <PriorityBadge priority={item.priority} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 leading-snug">{item.title}</p>
          {item.current_state && !expanded && (
            <p className="text-xs mt-0.5 text-slate-400 line-clamp-1">
              {item.current_state}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start mt-0.5">
          {item.automation_level === "now" && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}
              title="SecureWatch360 can automate this remediation"
            >
              <Zap size={10} />
              <span className="hidden sm:inline">Automate</span>
            </span>
          )}
          {hasDetail && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded transition-colors hover:bg-slate-700"
              style={{ color: "#64748b" }}
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && hasDetail && (
        <div
          className="px-4 sm:px-5 pb-4 space-y-3"
          style={{ background: "rgba(102,126,234,0.04)" }}
        >
          {item.current_state && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Current State</p>
              <p className="text-sm text-slate-300 leading-relaxed">{item.current_state}</p>
            </div>
          )}
          {item.desired_state && (
            <div className="flex items-start gap-2">
              <ArrowRight size={14} className="text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Target State</p>
                <p className="text-sm text-slate-300 leading-relaxed">{item.desired_state}</p>
              </div>
            </div>
          )}
          {item.recommended_action && (
            <div
              className="rounded-lg px-3 py-2.5"
              style={{ background: "rgba(102,126,234,0.08)", border: "1px solid rgba(102,126,234,0.2)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#a78bfa" }}>
                Recommended Action
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{item.recommended_action}</p>
            </div>
          )}
          {item.related_framework && (
            <p className="text-xs text-slate-500">
              Framework:{" "}
              <span className="font-mono" style={{ color: "#a78bfa" }}>
                {item.related_framework}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ gap }: { gap: GapItem }) {
  const CategoryIcon = CATEGORY_ICONS[gap.category] ?? AlertTriangle;
  const hasCritical = gap.criticalCount > 0;
  const hasHigh = gap.highCount > 0;

  const accentColor = hasCritical ? "#ef4444" : hasHigh ? "#f97316" : "#667eea";
  const headerBg = hasCritical ? "rgba(239,68,68,0.07)" : hasHigh ? "rgba(249,115,22,0.05)" : "rgba(102,126,234,0.05)";
  const iconClass = hasCritical ? "text-red-400" : hasHigh ? "text-orange-400" : "text-violet-400";

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-lg"
      style={{
        background: "#1e293b",
        border: `1px solid ${hasCritical ? "rgba(239,68,68,0.35)" : hasHigh ? "rgba(249,115,22,0.25)" : "#334155"}`,
      }}
    >
      {/* Category header */}
      <div
        className="flex items-center gap-3 px-4 sm:px-5 py-3.5"
        style={{
          background: headerBg,
          borderBottom: "1px solid #334155",
          borderLeft: `4px solid ${accentColor}`,
        }}
      >
        <CategoryIcon size={18} className={iconClass} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100">{gap.categoryLabel}</p>
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
        <div className="flex gap-1.5 shrink-0">
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

      {/* Gap items — each expandable */}
      <div>
        {gap.items.map((item) => (
          <GapItemRow key={item.id} item={item} />
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
        <p className="text-sm text-slate-400 mt-1">
          All key controls are addressed. Generate a new assessment to refresh your posture.
        </p>
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
        className="rounded-2xl px-5 sm:px-6 py-4 flex flex-wrap gap-4 sm:gap-6 items-center shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.2)",
          borderLeft: "4px solid #667eea",
        }}
      >
        <div>
          <p className="sw-kicker">Gap Analysis</p>
          <p className="text-xs mt-0.5 text-slate-400">
            Grouped by security domain · expand any item for details and recommended action
          </p>
        </div>
        <div className="flex gap-4 sm:gap-6 ml-auto flex-wrap">
          {[
            { label: "Total",    value: totalGaps,    color: "#94a3b8" },
            { label: "Critical", value: totalCritical, color: "#ef4444" },
            { label: "High",     value: totalHigh,     color: "#f97316" },
            { label: "Domains",  value: gaps.length,   color: "#a78bfa" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category cards — most severe first */}
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
