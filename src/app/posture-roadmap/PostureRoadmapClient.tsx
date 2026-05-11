"use client";

import { useState, useRef } from "react";
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
import { LoadingState } from "@/components/posture-roadmap/LoadingState";
import { EmptyState } from "@/components/posture-roadmap/EmptyState";
import { ErrorState } from "@/components/posture-roadmap/ErrorState";
import { AutomationModal } from "@/components/posture-roadmap/AutomationModal";
import type { ExecutionMode } from "@/components/posture-roadmap/AutomationModal";
import { GenerateAssessmentModal } from "@/components/posture-roadmap/GenerateAssessmentModal";

type Tab = "current" | "target" | "gaps" | "roadmap";

interface ErrorInfo {
  code?: string;
  message: string;
  hint?: string;
}

interface Props {
  tenantId: string;
  currentState: PostureCurrentState | null;
  targetState: PostureTargetState | null;
  gaps: GapItem[];
  roadmapItems: PostureRoadmapItem[];
  initialTargetFramework: string;
  totalRoadmapItems: number;
  criticalItems: number;
  automationAvailableCount: number;
  error?: string;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "current", label: "Current State", icon: "📍" },
  { id: "target",  label: "Target State",  icon: "🎯" },
  { id: "gaps",    label: "Gap Analysis",  icon: "⚡" },
  { id: "roadmap", label: "Roadmap",       icon: "🗺️" },
];

export function PostureRoadmapClient({
  tenantId,
  currentState: initialCurrentState,
  targetState: initialTargetState,
  gaps: initialGaps,
  roadmapItems,
  initialTargetFramework,
  totalRoadmapItems,
  criticalItems,
  automationAvailableCount,
  error: initialError,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("current");
  const [targetFramework, setTargetFramework] = useState(initialTargetFramework);
  const [targetState, setTargetState] = useState(initialTargetState);
  const [gaps, setGaps] = useState(initialGaps);
  const [currentState, setCurrentState] = useState(initialCurrentState);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(
    initialError ? { message: initialError } : null
  );

  // Automation modal state
  const [automationItem, setAutomationItem] = useState<PostureRoadmapItem | null>(null);

  // Generate Assessment modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }

  function handleRequestApproval(item: PostureRoadmapItem, _mode: ExecutionMode) {
    showToast(`Approval request submitted for "${item.title}"`);
  }

  const hasData = !!(currentState || targetState || roadmapItems.length > 0);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/posture-roadmap/summary?tenantId=${encodeURIComponent(tenantId)}&targetFramework=${encodeURIComponent(targetFramework)}`
      );
      const data = await res.json();
      if (!data.ok) {
        setError({ code: data.code, message: data.error ?? "Failed to load posture data.", hint: data.hint });
      } else {
        setCurrentState(data.currentState);
        setTargetState(data.targetState);
        setGaps(data.gaps ?? []);
      }
    } catch {
      setError({ message: "Failed to load posture assessment. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRunAssessment() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/posture-roadmap/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, targetFramework }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError({ code: json.code, message: json.error ?? "Failed to generate assessment.", hint: json.hint });
      } else {
        window.location.reload();
      }
    } catch {
      setError({ message: "Failed to generate assessment. Please try again." });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleFrameworkChange(fw: string) {
    if (fw === targetFramework || loadingTarget) return;
    setTargetFramework(fw);
    setLoadingTarget(true);

    try {
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

  // — Loading state
  if (isLoading) {
    return <LoadingState message="Loading posture assessment..." />;
  }

  // — Error state
  if (error) {
    return (
      <ErrorState
        code={error.code}
        message={error.message}
        hint={error.hint}
        onRetry={() => {
          setError(null);
          loadData();
        }}
      />
    );
  }

  // — Empty / no-data state
  if (!hasData) {
    return (
      <>
        <EmptyState
          tenantId={tenantId}
          onRunAssessment={() => setShowGenerateModal(true)}
          isGenerating={isGenerating}
        />
        <GenerateAssessmentModal
          isOpen={showGenerateModal}
          tenantId={tenantId}
          onClose={() => setShowGenerateModal(false)}
          onComplete={() => { setShowGenerateModal(false); window.location.reload(); }}
        />
      </>
    );
  }

  // — Guard: type narrowing for fully-populated data
  if (!currentState || !targetState) {
    return (
      <>
        <EmptyState
          tenantId={tenantId}
          onRunAssessment={() => setShowGenerateModal(true)}
          isGenerating={isGenerating}
        />
        <GenerateAssessmentModal
          isOpen={showGenerateModal}
          tenantId={tenantId}
          onClose={() => setShowGenerateModal(false)}
          onComplete={() => { setShowGenerateModal(false); window.location.reload(); }}
        />
      </>
    );
  }

  const completedPct =
    totalRoadmapItems > 0
      ? Math.round(
          (roadmapItems.filter((i) => i.status === "completed").length /
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
          <RoadmapPanel
            items={roadmapItems}
            tenantId={tenantId}
            onAutomate={(item) => setAutomationItem(item)}
          />
        )}
      </div>

      {/* Automation modal */}
      <AutomationModal
        item={automationItem}
        onClose={() => setAutomationItem(null)}
        onRequestApproval={handleRequestApproval}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold animate-slide-in"
          style={{
            background: "linear-gradient(135deg,#1565c0,#0d1e33)",
            border: "1px solid #29b6f6",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
}
