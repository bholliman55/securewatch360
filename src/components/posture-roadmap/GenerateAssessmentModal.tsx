"use client";

import { useState, useEffect, useRef } from "react";
import { ModalOverlay } from "./ModalOverlay";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateAssessmentModalProps {
  isOpen: boolean;
  tenantId: string;
  onClose: () => void;
  onComplete: (assessmentId?: string) => void;
}

type ModalState = "idle" | "loading" | "success" | "error";

interface Framework {
  id: string;
  icon: string;
  name: string;
  badge?: string;
  description: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FRAMEWORKS: Framework[] = [
  { id: "CMMC_L2",    icon: "🎯", name: "CMMC Level 2",    badge: "DEFAULT", description: "DoD contractor standard" },
  { id: "CMMC_L1",    icon: "🎯", name: "CMMC Level 1",    description: "Basic cyber hygiene" },
  { id: "CIS",        icon: "🛡️", name: "CIS Controls v8",  description: "18 critical security controls" },
  { id: "NIST_CSF",   icon: "📋", name: "NIST CSF 2.0",    description: "Federal risk management" },
  { id: "HIPAA",      icon: "🏥", name: "HIPAA Security Rule", description: "Healthcare data protection" },
  { id: "SOC2",       icon: "🔒", name: "SOC 2",           description: "Trust services criteria" },
];

const LOADING_STEPS = [
  "Pulling scan findings...",
  "Analyzing asset inventory...",
  "Running scoring engine...",
  "Generating gap analysis...",
  "Building remediation roadmap...",
];

const STEP_DELAYS_MS = [1500, 3000, 4500, 6000, 7500];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FrameworkCard({
  fw,
  selected,
  onSelect,
}: {
  fw: Framework;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(fw.id)}
      className="w-full text-left rounded-xl p-3.5 transition-all"
      style={{
        background: selected ? "rgba(0,229,255,0.06)" : "rgba(176,196,222,0.04)",
        border: `1.5px solid ${selected ? "#00e5ff" : "rgba(176,196,222,0.18)"}`,
        boxShadow: selected ? "0 0 16px rgba(0,229,255,0.1)" : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg shrink-0">{fw.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-bold"
              style={{ color: selected ? "#00e5ff" : "#e6edf5" }}
            >
              {fw.name}
            </span>
            {fw.badge && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(0,229,255,0.12)",
                  color: "#00e5ff",
                  border: "1px solid rgba(0,229,255,0.3)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.08em",
                }}
              >
                {fw.badge}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#8ab4d4" }}>
            {fw.description}
          </p>
        </div>
        <div
          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: selected ? "#00e5ff" : "rgba(176,196,222,0.35)",
            background: selected ? "#00e5ff" : "transparent",
          }}
        >
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-[#07111f]" />}
        </div>
      </div>
    </button>
  );
}

function AnalysisChecklist() {
  const [open, setOpen] = useState(true);
  const items = [
    "Scan findings and vulnerabilities",
    "Asset inventory and exposure",
    "Compliance control mappings",
    "Evidence records",
    "User and identity data",
    "Remediation action history",
  ];
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(176,196,222,0.15)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5"
        style={{ background: "rgba(176,196,222,0.05)" }}
      >
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "#29b6f6", fontFamily: "Rajdhani, Inter, sans-serif" }}
        >
          What will be analyzed
        </span>
        <span style={{ color: "#8ab4d4", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-3" style={{ background: "rgba(7,17,31,0.4)" }}>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-2" style={{ fontSize: "0.85rem", color: "#8ab4d4" }}>
                <span style={{ color: "#22c55e", fontSize: 13 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Animated radar-pulse SVG (same visual language as LoadingState)
function RadarPulse() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: "rgba(0,229,255,0.12)" }}
      />
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        className="relative"
        style={{ animation: "spin 2s linear infinite" }}
      >
        <circle
          cx="40"
          cy="40"
          r="30"
          fill="none"
          stroke="rgba(0,229,255,0.15)"
          strokeWidth="3"
        />
        <path
          d="M40 10 A30 30 0 0 1 70 40"
          fill="none"
          stroke="#00e5ff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="40" cy="40" r="4" fill="#00e5ff" />
      </svg>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Animated draw-in SVG checkmark
function AnimatedCheckmark() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{ background: "rgba(34,197,94,0.15)" }}
      />
      <svg width="80" height="80" viewBox="0 0 80 80" className="relative">
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeDasharray="213.6"
          strokeDashoffset="0"
          style={{
            animation: "drawCircle 0.6s ease-out forwards",
          }}
        />
        <polyline
          points="24,42 35,53 56,28"
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="50"
          strokeDashoffset="50"
          style={{
            animation: "drawCheck 0.4s 0.5s ease-out forwards",
          }}
        />
        <style>{`
          @keyframes drawCircle {
            from { stroke-dashoffset: 213.6; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes drawCheck {
            from { stroke-dashoffset: 50; }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
      </svg>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function GenerateAssessmentModal({
  isOpen,
  tenantId,
  onClose,
  onComplete,
}: GenerateAssessmentModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [selectedFramework, setSelectedFramework] = useState("CMMC_L2");
  const [completedSteps, setCompletedSteps] = useState(0);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [resultScore, setResultScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [errorHint, setErrorHint] = useState<string | undefined>();
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setState("idle");
      setSelectedFramework("CMMC_L2");
      setCompletedSteps(0);
      setAssessmentId(null);
      setResultScore(null);
      setErrorMessage("");
      setErrorCode(undefined);
      setErrorHint(undefined);
    }
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function startStepAnimation() {
    setCompletedSteps(0);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    STEP_DELAYS_MS.forEach((delay, idx) => {
      const t = setTimeout(() => {
        setCompletedSteps((prev) => Math.max(prev, idx + 1));
      }, delay);
      timeoutsRef.current.push(t);
    });
  }

  async function handleGenerate() {
    setState("loading");
    startStepAnimation();

    try {
      // Primary endpoint
      let res = await fetch("/api/posture-roadmap/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, targetFramework: selectedFramework }),
      });

      // Fallback if primary route doesn't exist yet
      if (res.status === 404) {
        res = await fetch("/api/posture-roadmap/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, targetFramework: selectedFramework }),
        });
      }

      const json = await res.json();

      if (!json.ok) {
        timeoutsRef.current.forEach(clearTimeout);
        setErrorMessage(json.error ?? "Assessment failed.");
        setErrorCode(json.code);
        setErrorHint(json.hint);
        setState("error");
        return;
      }

      // Let final step tick before showing success
      const remaining = Math.max(0, STEP_DELAYS_MS[STEP_DELAYS_MS.length - 1] - 500);
      await new Promise<void>((resolve) => setTimeout(resolve, remaining > 500 ? 500 : remaining));

      setAssessmentId(json.assessmentId ?? null);
      setResultScore(json.overallScore ?? null);
      setState("success");
    } catch {
      timeoutsRef.current.forEach(clearTimeout);
      setErrorMessage("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  function handleRetry() {
    timeoutsRef.current.forEach(clearTimeout);
    setCompletedSteps(0);
    setState("idle");
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <ModalOverlay onClose={onClose} maxWidth={520}>
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
                style={{
                  background: "rgba(21,101,192,0.15)",
                  border: "1.5px solid rgba(41,182,246,0.4)",
                  boxShadow: "0 0 20px rgba(41,182,246,0.2)",
                }}
              >
                📊
              </div>
              <div>
                <p className="sw-kicker mb-0.5">SecureWatch360</p>
                <h2
                  className="font-bold leading-tight"
                  style={{
                    fontFamily: "Rajdhani, Inter, sans-serif",
                    fontSize: "1.4rem",
                    color: "#fff",
                  }}
                >
                  Generate New Assessment
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-lg w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
              style={{ color: "#8ab4d4", background: "rgba(176,196,222,0.08)" }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Explanation card */}
          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(21,101,192,0.07)",
              border: "1px solid rgba(41,182,246,0.2)",
              borderLeft: "3px solid #29b6f6",
            }}
          >
            <p className="text-sm" style={{ color: "#c7dce8", lineHeight: 1.6 }}>
              SecureWatch360 will analyze your current assets, findings, policies, and available
              telemetry to create a current-state score, target-state comparison, gap analysis, and
              remediation roadmap.
            </p>
          </div>

          {/* Framework selector */}
          <div>
            <p
              className="text-xs uppercase tracking-wider font-semibold mb-2.5"
              style={{ color: "#8ab4d4" }}
            >
              Select Target Framework
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FRAMEWORKS.map((fw) => (
                <FrameworkCard
                  key={fw.id}
                  fw={fw}
                  selected={selectedFramework === fw.id}
                  onSelect={setSelectedFramework}
                />
              ))}
            </div>
          </div>

          {/* What will be analyzed */}
          <AnalysisChecklist />

          {/* Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleGenerate}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #1565c0, #1e88e5)",
                color: "#fff",
                border: "none",
                boxShadow: "0 4px 20px rgba(21,101,192,0.35)",
              }}
            >
              Generate Assessment
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "transparent", color: "#8ab4d4", border: "none" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      // No onClose — prevent accidental close while in flight
      <ModalOverlay maxWidth={520}>
        <div className="p-8 flex flex-col items-center text-center space-y-6">
          <RadarPulse />

          <div className="space-y-1.5">
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#fff" }}
            >
              Building posture roadmap…
            </h2>
            <p className="text-sm" style={{ color: "#8ab4d4" }}>
              This takes about 10–30 seconds depending on data volume.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-2.5">
            {LOADING_STEPS.map((step, idx) => {
              const done = completedSteps > idx;
              const active = completedSteps === idx;
              return (
                <div
                  key={step}
                  className="flex items-center gap-3 transition-all"
                  style={{ opacity: done || active ? 1 : 0.35 }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      background: done
                        ? "rgba(34,197,94,0.2)"
                        : active
                        ? "rgba(0,229,255,0.15)"
                        : "rgba(176,196,222,0.08)",
                      border: `1.5px solid ${done ? "#22c55e" : active ? "#00e5ff" : "rgba(176,196,222,0.2)"}`,
                      transition: "all 0.4s ease",
                    }}
                  >
                    {done ? (
                      <span style={{ color: "#22c55e", fontSize: 11 }}>✓</span>
                    ) : active ? (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: "#00e5ff",
                          animation: "pulse 1s ease-in-out infinite",
                        }}
                      />
                    ) : null}
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: done ? "#22c55e" : active ? "#e6edf5" : "#4d7a9e" }}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <ModalOverlay onClose={() => onComplete(assessmentId ?? undefined)} maxWidth={520}>
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <AnimatedCheckmark />

          <div className="space-y-2">
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#29b6f6" }}
            >
              Assessment Complete
            </h2>
            <p className="text-sm" style={{ color: "#8ab4d4", maxWidth: 380, margin: "0 auto" }}>
              Your posture roadmap is ready. Scroll down to see your current score, framework
              readiness, gap analysis, and prioritized roadmap.
            </p>
          </div>

          {resultScore !== null && (
            <div
              className="rounded-xl px-6 py-4"
              style={{
                background: "rgba(41,182,246,0.08)",
                border: "1px solid rgba(41,182,246,0.25)",
              }}
            >
              <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: "#8ab4d4" }}>
                Overall Posture Score
              </p>
              <p
                className="text-4xl font-bold tabular-nums"
                style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#29b6f6" }}
              >
                {resultScore}
              </p>
            </div>
          )}

          <button
            onClick={() => onComplete(assessmentId ?? undefined)}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{
              maxWidth: 320,
              background: "linear-gradient(135deg, #1565c0, #1e88e5)",
              color: "#fff",
              border: "none",
              boxShadow: "0 4px 20px rgba(21,101,192,0.35)",
            }}
          >
            View My Roadmap
          </button>
        </div>
      </ModalOverlay>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  const friendlyMessage =
    errorCode === "NO_SCAN_DATA"
      ? "No scan data found. Run a vulnerability scan first, then generate your assessment."
      : errorCode === "TENANT_NOT_FOUND"
      ? "Tenant not found. Verify your tenant ID."
      : errorMessage;

  return (
    <ModalOverlay onClose={onClose} maxWidth={520}>
      <div className="p-8 flex flex-col items-center text-center space-y-5">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1.5px solid rgba(239,68,68,0.4)",
            boxShadow: "0 0 24px rgba(239,68,68,0.15)",
          }}
        >
          ⚠️
        </div>

        <div className="space-y-2">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#ef4444" }}
          >
            Assessment Failed
          </h2>
          <p className="text-sm" style={{ color: "#c7dce8", maxWidth: 380, margin: "0 auto" }}>
            {friendlyMessage}
          </p>
          {errorHint && (
            <p className="text-xs" style={{ color: "#8ab4d4" }}>
              {errorHint}
            </p>
          )}
        </div>

        <div className="space-y-2 w-full" style={{ maxWidth: 320 }}>
          <button
            onClick={handleRetry}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, #1565c0, #1e88e5)",
              color: "#fff",
              border: "none",
              boxShadow: "0 4px 20px rgba(21,101,192,0.35)",
            }}
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "transparent", color: "#8ab4d4", border: "none" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
