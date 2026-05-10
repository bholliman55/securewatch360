"use client";

import { useState } from "react";
import type {
  PostureCurrentState,
  PostureTargetState,
  GapItem,
  PostureRoadmapItem,
} from "@/types/posture-roadmap";
import { CurrentStatePanel } from "@/components/posture-roadmap/CurrentStatePanel";
import { TargetStatePanel } from "@/components/posture-roadmap/TargetStatePanel";
import { GapAnalysisPanel } from "@/components/posture-roadmap/GapAnalysisPanel";
import { RoadmapPanel } from "@/components/posture-roadmap/RoadmapPanel";

type Tab = "current" | "target" | "gaps" | "roadmap";

interface Props {
  tenantId: string;
  currentState: PostureCurrentState;
  targetState: PostureTargetState;
  gaps: GapItem[];
  roadmapItems: PostureRoadmapItem[];
  initialTargetFramework: string;
  totalRoadmapItems: number;
  criticalItems: number;
  automationAvailableCount: number;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "current", label: "Current State", icon: "📍" },
  { id: "target",  label: "Target State",  icon: "🎯" },
  { id: "gaps",    label: "Gap Analysis",  icon: "⚡" },
  { id: "roadmap", label: "Roadmap",       icon: "🗺️" },
];

export function PostureRoadmapClient({
  tenantId,
  currentState,
  targetState: initialTargetState,
  gaps: initialGaps,
  roadmapItems,
  initialTargetFramework,
  totalRoadmapItems,
  criticalItems,
  automationAvailableCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("current");
  const [targetFramework, setTargetFramework] = useState(initialTargetFramework);
  const [targetState, setTargetState] = useState(initialTargetState);
  const [gaps, setGaps] = useState(initialGaps);
  const [loadingTarget, setLoadingTarget] = useState(false);

  async function handleFrameworkChange(fw: string) {
    if (fw === targetFramework || loadingTarget) return;
    setTargetFramework(fw);
    setLoadingTarget(true);

    try {
      // Persist the choice and reload summary for new target
      await fetch("/api/posture-roadmap/target", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, targetFramework: fw }),
      });

      const res = await fetch(
        `/api/posture-roadmap/summary?tenantId=${encodeURIComponent(tenantId)}&targetFramework=${encodeURIComponent(fw)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setTargetState(data.targetState);
          setGaps(data.gaps);
        }
      }
    } finally {
      setLoadingTarget(false);
    }
  }

  const completedPct =
    totalRoadmapItems > 0
      ? Math.round(
          ((roadmapItems.filter((i) => i.status === "completed").length) /
            totalRoadmapItems) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, #07111f 0%, #112d4e 60%, #1565c020 100%)",
          border: "1px solid rgba(41,182,246,0.25)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="sw-kicker mb-1">SecureWatch360</p>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#fff" }}
            >
              Posture Roadmap
            </h1>
            <p className="text-sm mt-1" style={{ color: "#8ab4d4" }}>
              Your current cybersecurity posture, where you need to be, and the prioritized path to close the gap.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap sm:flex-nowrap">
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(176,196,222,0.08)", border: "1px solid rgba(176,196,222,0.15)" }}>
              <div className="text-2xl font-bold" style={{ color: "#29b6f6" }}>
                {currentState.maturityScore}
              </div>
              <div className="text-xs" style={{ color: "#8ab4d4" }}>Maturity Score</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="text-2xl font-bold" style={{ color: "#ef4444" }}>
                {criticalItems}
              </div>
              <div className="text-xs" style={{ color: "#8ab4d4" }}>Critical Items</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <div className="text-2xl font-bold" style={{ color: "#22c55e" }}>
                {completedPct}%
              </div>
              <div className="text-xs" style={{ color: "#8ab4d4" }}>Roadmap Progress</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="text-2xl font-bold" style={{ color: "#22c55e" }}>
                ⚡{automationAvailableCount}
              </div>
              <div className="text-xs" style={{ color: "#8ab4d4" }}>Automatable</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(176,196,222,0.07)", border: "1px solid rgba(176,196,222,0.12)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={
              activeTab === tab.id
                ? {
                    background: "linear-gradient(135deg, #1565c0, #1e88e5)",
                    color: "#fff",
                    boxShadow: "0 2px 12px rgba(21,101,192,0.4)",
                  }
                : { color: "#8ab4d4" }
            }
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "current" && <CurrentStatePanel data={currentState} />}
        {activeTab === "target" && (
          <div>
            {loadingTarget && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm"
                style={{ background: "rgba(41,182,246,0.1)", color: "#29b6f6", border: "1px solid rgba(41,182,246,0.2)" }}
              >
                Loading target state for selected framework…
              </div>
            )}
            <TargetStatePanel
              data={targetState}
              targetFramework={targetFramework}
              onChangeFramework={handleFrameworkChange}
            />
          </div>
        )}
        {activeTab === "gaps" && <GapAnalysisPanel gaps={gaps} />}
        {activeTab === "roadmap" && (
          <RoadmapPanel items={roadmapItems} tenantId={tenantId} />
        )}
      </div>
    </div>
  );
}
