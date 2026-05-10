"use client";

import { useState, useTransition } from "react";
import type { PostureRoadmapItem, RoadmapStatus, RoadmapCategory } from "@/types/posture-roadmap";
import { ROADMAP_CATEGORY_LABELS } from "@/types/posture-roadmap";

interface Props {
  items: PostureRoadmapItem[];
  tenantId: string;
  onAutomate?: (item: PostureRoadmapItem) => void;
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "#ef444422", color: "#ef4444", border: "#ef444444" },
  high:     { bg: "#f9731622", color: "#f97316", border: "#f9731644" },
  medium:   { bg: "#eab30822", color: "#eab308", border: "#eab30844" },
  low:      { bg: "#22c55e22", color: "#22c55e", border: "#22c55e44" },
};

const STATUS_STYLES: Record<RoadmapStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "#8ab4d4", bg: "rgba(138,180,212,0.12)" },
  in_progress: { label: "In Progress", color: "#29b6f6", bg: "rgba(41,182,246,0.12)" },
  completed:   { label: "Completed",   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  deferred:    { label: "Deferred",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const EFFORT_LABELS: Record<string, string> = {
  low: "Low effort",
  medium: "Med effort",
  high: "High effort",
};

const AUTOMATION_STYLES = {
  now:    { label: "⚡ Automate Now",  bg: "#22c55e22", color: "#22c55e", border: "#22c55e44" },
  later:  { label: "🔮 Automate Later", bg: "#eab30822", color: "#eab308", border: "#eab30844" },
  not_yet:{ label: "Manual",           bg: "rgba(176,196,222,0.08)", color: "#8ab4d4", border: "rgba(176,196,222,0.2)" },
};

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

function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {priority}
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
        // silently fail; optimistic update can be reverted in a future iteration
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
          <option key={val} value={val} style={{ background: "#0d1e33", color: "#fff" }}>
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
  const auto = AUTOMATION_STYLES[item.automation_level];
  const impactColor =
    item.estimated_impact_score >= 80 ? "#22c55e"
    : item.estimated_impact_score >= 60 ? "#eab308"
    : "#8ab4d4";

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
        border: `1px solid ${
          item.priority === "critical" ? "rgba(239,68,68,0.3)"
          : item.priority === "high" ? "rgba(249,115,22,0.25)"
          : "rgba(176,196,222,0.18)"
        }`,
      }}
    >
      {/* Card header */}
      <div className="px-5 py-4 flex items-start gap-3">
        <span className="text-lg mt-0.5 shrink-0">
          {CATEGORY_ICONS[item.category] ?? "⚙️"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <PriorityBadge priority={item.priority} />
            {item.related_framework && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: "rgba(41,182,246,0.12)", color: "#29b6f6" }}
              >
                {item.related_framework}
              </span>
            )}
            <span className="text-xs" style={{ color: "#8ab4d4" }}>
              {ROADMAP_CATEGORY_LABELS[item.category]}
            </span>
          </div>
          <p className="text-sm font-semibold leading-snug" style={{ color: "#e6edf5" }}>
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
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: "#8ab4d4", background: "rgba(176,196,222,0.08)", border: "1px solid rgba(176,196,222,0.15)" }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div
        className="px-5 py-2.5 flex flex-wrap gap-4 items-center"
        style={{ borderTop: "1px solid rgba(176,196,222,0.08)", background: "rgba(176,196,222,0.03)" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "#8ab4d4" }}>Effort:</span>
          <span className="text-xs font-semibold" style={{ color: "#e6edf5" }}>
            {EFFORT_LABELS[item.estimated_effort]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "#8ab4d4" }}>Impact:</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: impactColor }}>
            {item.estimated_impact_score}/100
          </span>
          <div className="w-16 h-1.5 rounded-full" style={{ background: "rgba(176,196,222,0.15)" }}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${item.estimated_impact_score}%`, background: impactColor }}
            />
          </div>
        </div>
        <div className="ml-auto">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: auto.bg, color: auto.color, border: `1px solid ${auto.border}` }}
          >
            {auto.label}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="px-5 py-4 space-y-3"
          style={{ borderTop: "1px solid rgba(176,196,222,0.1)" }}
        >
          {item.current_state && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#8ab4d4" }}>
                Current State
              </p>
              <p className="text-sm" style={{ color: "#e6edf5" }}>{item.current_state}</p>
            </div>
          )}
          {item.desired_state && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#8ab4d4" }}>
                Desired State
              </p>
              <p className="text-sm" style={{ color: "#e6edf5" }}>{item.desired_state}</p>
            </div>
          )}
          {item.recommended_action && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(41,182,246,0.06)", border: "1px solid rgba(41,182,246,0.15)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#29b6f6" }}>
                Recommended Action
              </p>
              <p className="text-sm" style={{ color: "#e6edf5" }}>{item.recommended_action}</p>
            </div>
          )}
          {item.automation_level === "now" && (
            <div
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <span className="text-lg shrink-0">⚡</span>
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: "#22c55e" }}>
                  SecureWatch360 Can Automate This Now
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#86efac" }}>
                  This control can be automatically remediated or monitored using the SecureWatch360 platform.
                  Mark as In Progress and assign to the automation engine to begin.
                </p>
              </div>
              {onAutomate && (
                <button
                  onClick={() => onAutomate(item)}
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: "linear-gradient(135deg, #00bcd4, #0097a7)",
                    color: "#fff",
                    border: "none",
                    boxShadow: "0 2px 12px rgba(0,229,255,0.25)",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ Automate
                </button>
              )}
            </div>
          )}
          {item.automation_level === "later" && onAutomate && (
            <div className="flex justify-end">
              <button
                onClick={() => onAutomate(item)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: "rgba(234,179,8,0.1)",
                  color: "#eab308",
                  border: "1px solid rgba(234,179,8,0.3)",
                }}
              >
                🔮 Automate with SecureWatch360
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
        className="rounded-2xl px-6 py-4 flex flex-wrap gap-6 items-center"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.2)",
        }}
      >
        <div>
          <p className="sw-kicker">Roadmap</p>
          <p className="text-xs mt-0.5" style={{ color: "#8ab4d4" }}>
            {items.length} items across {new Set(items.map((i) => i.category)).size} security domains
          </p>
        </div>
        <div className="flex gap-5 ml-auto flex-wrap">
          {[
            { label: "Total", value: items.length, color: "#8ab4d4" },
            { label: "Critical", value: criticalCount, color: "#ef4444" },
            { label: "Completed", value: completedCount, color: "#22c55e" },
            { label: "⚡ Automatable", value: automationCount, color: "#22c55e" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs" style={{ color: "#8ab4d4" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as RoadmapStatus | "")}
          className="text-xs rounded-lg px-3 py-2 appearance-none"
          style={{ background: "#0d1e33", color: "#e6edf5", border: "1px solid rgba(176,196,222,0.2)" }}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs rounded-lg px-3 py-2 appearance-none"
          style={{ background: "#0d1e33", color: "#e6edf5", border: "1px solid rgba(176,196,222,0.2)" }}
        >
          <option value="">All priorities</option>
          {["critical", "high", "medium", "low"].map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as RoadmapCategory | "")}
          className="text-xs rounded-lg px-3 py-2 appearance-none"
          style={{ background: "#0d1e33", color: "#e6edf5", border: "1px solid rgba(176,196,222,0.2)" }}
        >
          <option value="">All categories</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ROADMAP_CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <label
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer select-none"
          style={{
            background: showAutomationOnly ? "rgba(34,197,94,0.12)" : "#0d1e33",
            color: showAutomationOnly ? "#22c55e" : "#8ab4d4",
            border: `1px solid ${showAutomationOnly ? "rgba(34,197,94,0.35)" : "rgba(176,196,222,0.2)"}`,
          }}
        >
          <input
            type="checkbox"
            checked={showAutomationOnly}
            onChange={(e) => setShowAutomationOnly(e.target.checked)}
            className="sr-only"
          />
          ⚡ Automatable only
        </label>

        {(filterStatus || filterPriority || filterCategory || showAutomationOnly) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterPriority(""); setFilterCategory(""); setShowAutomationOnly(false); }}
            className="text-xs px-3 py-2 rounded-lg"
            style={{ color: "#8ab4d4", background: "rgba(176,196,222,0.08)", border: "1px solid rgba(176,196,222,0.15)" }}
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs self-center" style={{ color: "#8ab4d4" }}>
          {filtered.length} of {items.length} shown
        </span>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: "#8ab4d4" }}>
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">No items match the current filters.</p>
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
