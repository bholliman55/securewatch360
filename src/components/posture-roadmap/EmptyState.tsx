"use client";

interface EmptyStateProps {
  tenantId: string;
  onRunAssessment: () => void;
  isGenerating: boolean;
}

export function EmptyState({ onRunAssessment, isGenerating }: EmptyStateProps) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center text-center animate-fade-in"
      style={{
        background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
        border: "1px solid rgba(41,182,246,0.2)",
        padding: "3rem 2rem",
      }}
    >
      {/* Shield icon with glow */}
      <div
        className="mb-6 relative flex items-center justify-center"
        style={{ width: 96, height: 96 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,229,255,0.18) 0%, transparent 72%)",
            animation: "pulse 2.5s ease-in-out infinite",
          }}
        />
        <span
          role="img"
          aria-label="Shield"
          style={{
            fontSize: "4rem",
            lineHeight: 1,
            filter: "drop-shadow(0 0 18px rgba(0,229,255,0.55))",
          }}
        >
          🛡️
        </span>
      </div>

      {/* Title */}
      <h2
        className="font-bold mb-3"
        style={{
          fontFamily: "Rajdhani, Inter, sans-serif",
          fontSize: "1.75rem",
          color: "#fff",
          lineHeight: 1.2,
        }}
      >
        No Posture Assessment Yet
      </h2>

      {/* Body */}
      <p
        className="mb-8 max-w-sm"
        style={{ color: "#8ab4d4", fontSize: "0.9375rem", lineHeight: 1.6 }}
      >
        No posture assessment has been generated yet. Run your first assessment to see where you
        are, where you need to be, and what to fix first.
      </p>

      {/* CTA button */}
      <button
        onClick={onRunAssessment}
        disabled={isGenerating}
        className="flex items-center justify-center gap-2 font-semibold rounded-xl transition-all"
        style={{
          width: "100%",
          maxWidth: 320,
          padding: "0.875rem 1.5rem",
          fontSize: "0.9375rem",
          background: isGenerating
            ? "rgba(0,229,255,0.15)"
            : "linear-gradient(135deg, #00c8e0 0%, #0097a7 100%)",
          color: isGenerating ? "#8ab4d4" : "#07111f",
          border: isGenerating ? "1px solid rgba(0,229,255,0.3)" : "none",
          cursor: isGenerating ? "not-allowed" : "pointer",
          boxShadow: isGenerating ? "none" : "0 4px 24px rgba(0,229,255,0.35)",
        }}
      >
        {isGenerating ? (
          <>
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray="31.4"
                strokeDashoffset="10"
              />
            </svg>
            Generating Assessment...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Run First Assessment
          </>
        )}
      </button>

      {/* Subtext */}
      <p className="mt-4 text-xs" style={{ color: "#4d7a9e" }}>
        Assessment takes ~30 seconds. Based on your current scan data, findings, and asset
        inventory.
      </p>
    </div>
  );
}
