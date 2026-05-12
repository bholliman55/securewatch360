"use client";

import { useState, useTransition } from "react";
import { Lock, Server, Globe, Bug, Database, Activity, ClipboardCheck, GraduationCap, AlertTriangle, Zap, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { PostureRoadmapItem, RoadmapStatus, RoadmapCategory } from "@/types/posture-roadmap";
import { ROADMAP_CATEGORY_LABELS } from "@/types/posture-roadmap";

interface Props {
  items: PostureRoadmapItem[];
  tenantId: string;
  onAutomate?: (item: PostureRoadmapItem) => void;
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

const STATUS_STYLES: Record<RoadmapStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  in_progress: { label: "In Progress", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  completed:   { label: "Completed",   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  deferred:    { label: "Deferred",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const EFFORT_LABELS: Record<string, string> = {
  low:    "Low Effort",
  medium: "Medium Effort",
  high:   "High Effort",
};

const AUTOMATION_STYLES = {
  now:     { label: "Automate Now",   bg: "#22c55e22", color: "#22c55e", border: "#22c55e44" },
  later:   { label: "Automate Later", bg: "#eab30822", color: "#eab308", border: "#eab30844" },
  not_yet: { label: "Manual",         bg: "rgba(102,126,234,0.08)", color: "#94a3b8", border: "rgba(102,126,234,0.2)" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function StatusSelect({
  itemId,
  tenantId,
  current,
  onUpdate,
}: {
  itemId: string;
  tenantId: string;
  current: RoadmapStatus;
  onUpdate: (id: string, status: RoadmapStatus) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as RoadmapStatus;
    startTransition(async () => {
      try {
        await fetch(`/api/posture-roadmap/roadmap/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, status: newStatus }),
        });
        onUpdate(itemId, newStatus);
      } catch {
        // silently fail
      }
    });
  }

  const s = STATUS_STYLES[current];
  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={isPending}
      className="text-xs font-semibold rounded-lg px-2 py-1 cursor-pointer appearance-none"
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}44`,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {(Object.entries(STATUS_STYLES) as [RoadmapStatus, (typeof STATUS_STYLES)[RoadmapStatus]][]).map(
        ([val, meta]) => (
          <option key={val} value={val} style={{ background: "#0f172a", color: "#f1f5f9" }}>
            {meta.label}
          </option>
        )
      )}
    </select>
  );
}

function RoadmapCard({
  item,
  tenantId,
  onStatusUpdate,
  onAutomate,
}: {
  item: PostureRoadmapItem;
  tenantId: string;
  onStatusUpdate: (id: string, status: RoadmapStatus) => void;
  onAutomate?: (item: PostureRoadmapItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[item.category] ?? AlertTriangle;
  const auto = AUTOMATION_STYLES[item.automation_level];
  const impactColor =
    item.estimated_impact_score >= 80 ? "#22c55e"
    : item.estimated_impact_score >= 60 ? "#eab308"
    : "#94a3b8";

  const borderColor =
    item.priority === "critical" ? "rgba(239,68,68,0.35)"
    : item.priority === "high" ? "rgba(249,115,22,0.3)"
    : "#334155";

  const leftAccent =
    item.priority === "critical" ? "#ef4444"
    : item.priority === "high" ? "#f97316"
    : "#667eea";

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-lg transition-all"
      style={{
        background: "#1e293b",
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${leftAccent}`,
      }}
    >
      {/* Card header */}
      <div className="px-5 py-4 flex items-start gap-3">
        <CategoryIcon size={18} className="mt-0.5 shrink-0 text-slate-400" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <PriorityBadge priority={item.priority} />
            {item.related_framework && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "rgba(102,126,234,0.15)", color: "#a78bfa" }}
              >
                {item.related_framework}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {ROADMAP_CATEGORY_LABELS[item.category]}
            </span>
          </div>
          <p className="text-sm font-semibold leading-snug text-slate-100">
            {item.title}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusSelect
            itemId={item.id}
            tenantId={tenantId}
            current={item.status}
            onUpdate={onStatusUpdate}
          />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#94a3b8", background: "rgba(102,126,234,0.08)", border: "1px solid #334155" }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div
        className="px-5 py-2.5 flex flex-wrap gap-4 items-center"
        style={{ borderTop: "1px solid #334155", background: "rgba(102,126,234,0.03)" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Effort:</span>
          <span className="text-xs font-semibold text-slate-100">
            {EFFORT_LABELS[item.estimated_effort]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Impact:</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: impactColor }}>
            {item.estimated_impact_score}/100
          </span>
          <div className="w-16 h-1.5 rounded-full" style={{ background: "rgba(102,126,234,0.15)" }}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${item.estimated_impact_score}%`, background: impactColor }}
            />
          </div>
        </div>
        <div className="ml-auto">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: auto.bg, color: auto.color, border: `1px solid ${auto.border}` }}
          >
            {item.automation_level === "now" && <Zap size={10} />}
            {auto.label}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid #334155" }}>
          {item.current_state && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">Current State</p>
              <p className="text-sm text-slate-100">{item.current_state}</p>
            </div>
          )}
          {item.desired_state && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">Desired State</p>
              <p className="text-sm text-slate-100">{item.desired_state}</p>
            </div>
          )}
          {item.recommended_action && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(102,126,234,0.08)", border: "1px solid rgba(102,126,234,0.2)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#a78bfa" }}>
                Recommended Action
              </p>
              <p className="text-sm text-slate-100">{item.recommended_action}</p>
            </div>
          )}
          {item.automation_level === "now" && (
            <div
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <Zap size={16} className="shrink-0 text-green-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-green-400">
                  SecureWatch360 Can Automate This Now
                </p>
                <p className="text-xs mt-0.5 text-green-300">
                  This control can be automatically remediated or monitored using the SecureWatch360 platform.
                  Mark as In Progress and assign to the automation engine to begin.
                </p>
              </div>
              {onAutomate && (
                <button
                  onClick={() => onAutomate(item)}
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    border: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="flex items-center gap-1"><Zap size={11} /> Automate</span>
                </button>
              )}
            </div>
          )}
          {item.automation_level === "later" && onAutomate && (
            <div className="flex justify-end">
              <button
                onClick={() => onAutomate(item)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  background: "rgba(102,126,234,0.1)",
                  color: "#a78bfa",
                  border: "1px solid rgba(102,126,234,0.3)",
                }}
              >
                Automate with SecureWatch360
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ALL_STATUSES: RoadmapStatus[] = ["not_started", "in_progress", "completed", "deferred"];
const ALL_CATEGORIES = Object.keys(ROADMAP_CATEGORY_LABELS) as RoadmapCategory[];

const SELECT_STYLE = {
  background: "#0f172a",
  color: "#f1f5f9",
  border: "1px solid #334155",
};

export function RoadmapPanel({ items: initialItems, tenantId, onAutomate }: Props) {
  const [items, setItems] = useState<PostureRoadmapItem[]>(initialItems);
  const [filterStatus, setFilterStatus] = useState<RoadmapStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<RoadmapCategory | "">("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [showAutomationOnly, setShowAutomationOnly] = useState(false);

  function handleStatusUpdate(id: string, status: RoadmapStatus) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  const filtered = items.filter((item) => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterPriority && item.priority !== filterPriority) return false;
    if (showAutomationOnly && item.automation_level !== "now") return false;
    return true;
  });

  const criticalCount = items.filter((i) => i.priority === "critical").length;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const automationCount = items.filter((i) => i.automation_level === "now").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats bar */}
      <div
        className="rounded-2xl px-6 py-4 flex flex-wrap gap-6 items-center shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.2)",
          borderLeft: "4px solid #667eea",
        }}
      >
        <div>
          <p className="sw-kicker">Roadmap</p>
          <p className="text-xs mt-0.5 text-slate-400">
            {items.length} items across {new Set(items.map((i) => i.category)).size} security domains
          </p>
        </div>
        <div className="flex gap-5 ml-auto flex-wrap">
          {[
            { label: "Total",       value: items.length,    color: "#94a3b8" },
            { label: "Critical",    value: criticalCount,   color: "#ef4444" },
            { label: "Completed",   value: completedCount,  color: "#22c55e" },
            { label: "Automatable", value: automationCount, color: "#22c55e" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as RoadmapStatus | "")}
          className="text-xs rounded-lg px-2 sm:px-3 py-2 appearance-none"
          style={SELECT_STYLE}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs rounded-lg px-2 sm:px-3 py-2 appearance-none"
          style={SELECT_STYLE}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {["critical", "high", "medium", "low"].map((p) => (
            <option key={p} value={p}>{PRIORITY_STYLES[p]?.label ?? p}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as RoadmapCategory | "")}
          className="text-xs rounded-lg px-2 sm:px-3 py-2 appearance-none hidden sm:block"
          style={SELECT_STYLE}
          aria-label="Filter by category"
        >
          <option value="">All domains</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ROADMAP_CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <label
          className="flex items-center gap-1.5 text-xs px-2.5 sm:px-3 py-2 rounded-lg cursor-pointer select-none"
          style={{
            background: showAutomationOnly ? "rgba(34,197,94,0.12)" : "#0f172a",
            color: showAutomationOnly ? "#22c55e" : "#94a3b8",
            border: `1px solid ${showAutomationOnly ? "rgba(34,197,94,0.35)" : "#334155"}`,
          }}
        >
          <input
            type="checkbox"
            checked={showAutomationOnly}
            onChange={(e) => setShowAutomationOnly(e.target.checked)}
            className="sr-only"
          />
          <Zap size={11} />
          <span className="hidden sm:inline">Automatable only</span>
          <span className="sm:hidden">Automate</span>
        </label>

        {(filterStatus || filterPriority || filterCategory || showAutomationOnly) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterPriority(""); setFilterCategory(""); setShowAutomationOnly(false); }}
            className="text-xs px-2.5 sm:px-3 py-2 rounded-lg transition-colors hover:bg-slate-700"
            style={{ color: "#94a3b8", background: "rgba(102,126,234,0.08)", border: "1px solid #334155" }}
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs self-center text-slate-500 tabular-nums">
          {filtered.length} / {items.length}
        </span>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-12 rounded-2xl"
          style={{ background: "#1e293b", border: "1px solid #334155" }}
        >
          <Search size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No items match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <RoadmapCard
              key={item.id}
              item={item}
              tenantId={tenantId}
              onStatusUpdate={handleStatusUpdate}
              onAutomate={onAutomate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
