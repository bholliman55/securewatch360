"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import type { PostureTargetState } from "@/types/posture-roadmap";

interface Props {
  data: PostureTargetState;
  targetFramework: string;
  onChangeFramework: (fw: string) => void;
}

const FRAMEWORK_OPTIONS = [
  { value: "CMMC_L2", label: "CMMC Level 2" },
  { value: "CMMC_L1", label: "CMMC Level 1" },
  { value: "NIST",    label: "NIST CSF 2.0" },
  { value: "CIS",     label: "CIS Controls v8" },
  { value: "HIPAA",   label: "HIPAA Security Rule" },
  { value: "SOC2",    label: "SOC 2" },
];

function DistanceMeter({ current, required }: { current: number; required: number }) {
  const met = current >= required;
  const pct = Math.min(100, Math.round((current / required) * 100));
  const color = met ? "#22c55e" : pct >= 75 ? "#eab308" : pct >= 50 ? "#f97316" : "#ef4444";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">Maturity score</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {current} / {required}
        </span>
      </div>
      <div className="relative h-3 rounded-full" style={{ background: "rgba(102,126,234,0.12)" }}>
        <div
          className="h-3 rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition: "width 0.8s ease",
          }}
        />
      </div>
      {met ? (
        <p className="text-xs font-semibold text-green-400">
          ✓ Your maturity score meets the certification threshold for this framework.
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          Close{" "}
          <strong style={{ color }}>{required - current} point{required - current !== 1 ? "s" : ""}</strong>{" "}
          to reach the readiness threshold. Each completed roadmap item improves your score.
        </p>
      )}
    </div>
  );
}

export function TargetStatePanel({ data, targetFramework, onChangeFramework }: Props) {
  const [showControls, setShowControls] = useState(false);

  const readinessPercent =
    data.requiredControlCount > 0
      ? Math.round((data.metControlCount / data.requiredControlCount) * 100)
      : 0;

  const gapControls = data.keyRequiredControls.filter((c) => c.status === "gap");
  const metControls = data.keyRequiredControls.filter((c) => c.status === "met");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Framework selector */}
      <div
        className="rounded-2xl p-5 sm:p-6 shadow-lg"
        style={{
          background: "#1e293b",
          border: "1px solid rgba(102,126,234,0.2)",
          borderLeft: "4px solid #667eea",
        }}
      >
        <p className="sw-kicker mb-3">Target Framework</p>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChangeFramework(opt.value)}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                targetFramework === opt.value
                  ? {
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "#fff",
                      border: "1px solid rgba(102,126,234,0.5)",
                      boxShadow: "0 2px 12px rgba(102,126,234,0.3)",
                    }
                  : {
                      background: "rgba(102,126,234,0.08)",
                      color: "#94a3b8",
                      border: "1px solid #334155",
                    }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview stats */}
      <div
        className="rounded-2xl p-5 sm:p-6 space-y-5 shadow-lg"
        style={{ background: "#1e293b", border: "1px solid rgba(102,126,234,0.2)" }}
      >
        <div>
          <p className="sw-kicker mb-1">Readiness Overview</p>
          <p className="text-2xl font-bold text-slate-100">{data.targetFrameworkDisplayName}</p>
        </div>

        <DistanceMeter current={data.currentMaturityScore} required={data.requiredMaturityScore} />

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Required Controls", value: data.requiredControlCount, color: "#94a3b8" },
            { label: "Controls Met",       value: data.metControlCount,      color: "#22c55e" },
            { label: "Gaps Remaining",    value: data.currentGapCount,      color: data.currentGapCount > 0 ? "#ef4444" : "#22c55e" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 sm:p-4 text-center"
              style={{ background: "rgba(102,126,234,0.07)", border: "1px solid #334155" }}
            >
              <div className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs mt-1 text-slate-400 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Control coverage bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Controls covered</span>
            <span className="font-bold tabular-nums" style={{ color: readinessPercent >= 80 ? "#22c55e" : "#eab308" }}>
              {readinessPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(102,126,234,0.12)" }}>
            <div
              className="h-2 rounded-full"
              style={{
                width: `${readinessPercent}%`,
                background: readinessPercent >= 80
                  ? "linear-gradient(90deg, #15803d, #22c55e)"
                  : "linear-gradient(90deg, #667eea, #764ba2)",
                transition: "width 0.8s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Key controls — collapsed by default to keep exec view clean */}
      {data.keyRequiredControls.length > 0 && (
        <div
          className="rounded-2xl shadow-lg overflow-hidden"
          style={{ background: "#1e293b", border: "1px solid rgba(102,126,234,0.2)" }}
        >
          {/* Summary header — always visible */}
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sw-kicker mb-1">Key Controls</p>
                <p className="text-sm text-slate-300">
                  {gapControls.length > 0 ? (
                    <>
                      <span className="font-semibold text-red-400">{gapControls.length} gap{gapControls.length !== 1 ? "s" : ""}</span>
                      {" "}and{" "}
                      <span className="font-semibold text-green-400">{metControls.length} met</span>
                      {" "}out of {data.keyRequiredControls.length} key requirements
                    </>
                  ) : (
                    <span className="text-green-400 font-semibold">All key controls met</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowControls((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors"
                style={{
                  background: "rgba(102,126,234,0.1)",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                }}
              >
                {showControls ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> View details</>}
              </button>
            </div>

            {/* Gap summary pills — always visible */}
            {gapControls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {gapControls.slice(0, 4).map((ctrl) => (
                  <span
                    key={ctrl.controlCode}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    {ctrl.controlTitle}
                  </span>
                ))}
                {gapControls.length > 4 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}
                  >
                    +{gapControls.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Expandable detail table */}
          {showControls && (
            <div
              className="border-t px-5 sm:px-6 pb-5"
              style={{ borderColor: "#334155" }}
            >
              <p className="text-xs text-slate-500 py-3 mb-1">
                Control codes reference the framework specification. Gaps represent requirements not yet addressed by your current controls or evidence.
              </p>
              <div className="space-y-1.5">
                {data.keyRequiredControls.map((ctrl) => (
                  <div
                    key={ctrl.controlCode}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(102,126,234,0.05)", border: "1px solid #334155" }}
                  >
                    {ctrl.status === "met" ? (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-red-500 shrink-0" />
                    )}
                    <span
                      className="text-xs font-mono font-bold shrink-0 hidden sm:inline"
                      style={{ color: "#a78bfa", minWidth: "88px" }}
                    >
                      {ctrl.controlCode}
                    </span>
                    <span className="text-sm flex-1 min-w-0 text-slate-200 leading-snug">
                      {ctrl.controlTitle}
                    </span>
                    <span
                      className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                      style={
                        ctrl.status === "met"
                          ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
                          : { background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }
                      }
                    >
                      {ctrl.status === "met" ? "Met" : "Gap"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
