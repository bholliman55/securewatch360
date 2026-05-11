"use client";

import { useState, useRef } from "react";
import { Shield, Target, Zap, Map, RefreshCw, Info } from "lucide-react";
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

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "current", label: "Current State", Icon: Shield },
  { id: "target",  label: "Target State",  Icon: Target },
  { id: "gaps",    label: "Gap Analysis",  Icon: Zap },
  { id: "roadmap", label: "Roadmap",       Icon: Map },
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

  const [automationItem, setAutomationItem] = useState<PostureRoadmapItem | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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

  if (isLoading) {
    return <LoadingState message="Loading posture assessment..." />;
  }

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, rgba(102,126,234,0.12) 100%)",
          border: "1px solid rgba(102,126,234,0.3)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="sw-kicker mb-1">SecureWatch360</p>
            <h1 className="text-2xl font-bold text-slate-100">
              Posture Roadmap
            </h1>
            <p className="text-sm mt-1 text-slate-400">
              Your current cybersecurity posture, where you need to be, and the prioritized path to close the gap.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap items-start">
            {/* Generate new assessment button */}
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 whitespace-nowrap self-center"
              style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff" }}
            >
              <RefreshCw size={14} />
              New Assessment
            </button>

            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(102,126,234,0.12)", border: "1px solid rgba(102,126,234,0.25)" }}>
              <div className="text-2xl font-bold" style={{ color: "#a78bfa" }}>
                {currentState.maturityScore}
              </div>
              <div className="text-xs text-slate-400">Maturity Score</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="text-2xl font-bold text-red-500">
                {criticalItems}
              </div>
              <div className="text-xs text-slate-400">Critical Items</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <div className="text-2xl font-bold text-green-500">
                {completedPct}%
              </div>
              <div className="text-xs text-slate-400">Roadmap Progress</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="text-2xl font-bold text-green-500 flex items-center justify-center gap-1">
                <Zap size={18} />
                {automationAvailableCount}
              </div>
              <div className="text-xs text-slate-400">Automatable</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "rgba(102,126,234,0.07)", border: "1px solid rgba(102,126,234,0.15)" }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "#fff",
                      boxShadow: "0 2px 12px rgba(102,126,234,0.4)",
                    }
                  : { color: "#94a3b8" }
              }
            >
              <tab.Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Estimated data banner */}
      {currentState.isEstimated && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", borderLeft: "3px solid #eab308" }}
        >
          <Info size={15} className="text-yellow-400 shrink-0" />
          <p className="text-yellow-300">
            <strong>Estimated assessment</strong> — limited scan data was available. Scores and gaps are based on best-guess defaults.
            Run a full scan and regenerate for accurate results.
          </p>
        </div>
      )}

      {/* Tab content */}
      <div>
        {activeTab === "current" && <CurrentStatePanel data={currentState} />}
        {activeTab === "target" && (
          <div>
            {loadingTarget && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm"
                style={{ background: "rgba(102,126,234,0.1)", color: "#a78bfa", border: "1px solid rgba(102,126,234,0.2)" }}
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

      {/* Generate Assessment modal */}
      <GenerateAssessmentModal
        isOpen={showGenerateModal}
        tenantId={tenantId}
        onClose={() => setShowGenerateModal(false)}
        onComplete={() => { setShowGenerateModal(false); window.location.reload(); }}
      />

      {/* Automation modal */}
      <AutomationModal
        item={automationItem}
        onClose={() => setAutomationItem(null)}
        onRequestApproval={handleRequestApproval}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(102,126,234,0.4)",
          }}
        >
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
}
