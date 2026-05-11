"use client";

import { Shield, ArrowRight, Loader2 } from "lucide-react";

interface EmptyStateProps {
  tenantId: string;
  onRunAssessment: () => void;
  isGenerating: boolean;
}

export function EmptyState({ onRunAssessment, isGenerating }: EmptyStateProps) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center text-center animate-fade-in shadow-xl"
      style={{
        background: "#1e293b",
        border: "1px solid rgba(102,126,234,0.25)",
        padding: "3rem 2rem",
      }}
    >
      {/* Shield icon with gradient glow */}
      <div
        className="mb-6 relative flex items-center justify-center"
        style={{ width: 96, height: 96 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(102,126,234,0.2) 0%, transparent 72%)",
            animation: "pulse 2.5s ease-in-out infinite",
          }}
        />
        <div
          className="relative flex items-center justify-center w-16 h-16 rounded-2xl"
          style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
        >
          <Shield size={32} className="text-white" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold mb-3 text-slate-100">
        No Posture Assessment Yet
      </h2>

      {/* Body */}
      <p className="mb-8 max-w-sm text-slate-400" style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
        No posture assessment has been generated yet. Run your first assessment to see where you
        are, where you need to be, and what to fix first.
      </p>

      {/* CTA button */}
      <button
        onClick={onRunAssessment}
        disabled={isGenerating}
        className="flex items-center justify-center gap-2 font-semibold rounded-xl transition-opacity hover:opacity-90"
        style={{
          width: "100%",
          maxWidth: 320,
          padding: "0.875rem 1.5rem",
          fontSize: "0.9375rem",
          background: isGenerating
            ? "rgba(102,126,234,0.15)"
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: isGenerating ? "#94a3b8" : "#fff",
          border: isGenerating ? "1px solid rgba(102,126,234,0.3)" : "none",
          cursor: isGenerating ? "not-allowed" : "pointer",
          boxShadow: isGenerating ? "none" : "0 4px 24px rgba(102,126,234,0.35)",
        }}
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating Assessment...
          </>
        ) : (
          <>
            <ArrowRight size={16} />
            Run First Assessment
          </>
        )}
      </button>

      {/* Subtext */}
      <p className="mt-4 text-xs text-slate-500">
        Assessment takes ~30 seconds. Based on your current scan data, findings, and asset inventory.
      </p>
    </div>
  );
}
