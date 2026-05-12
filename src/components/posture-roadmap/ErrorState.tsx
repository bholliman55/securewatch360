"use client";

interface ErrorStateProps {
  code?: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
}

const ERROR_MESSAGES: Record<string, { title: string; hint: string }> = {
  NO_SCAN_DATA: {
    title: "No scan data available",
    hint: "Run a vulnerability scan first to generate a posture assessment. Go to Scan Runs → Request Scan.",
  },
  TENANT_NOT_FOUND: {
    title: "Tenant not found",
    hint: "Verify the tenant ID in the URL is correct.",
  },
  ASSESSMENT_NOT_FOUND: {
    title: "Assessment not found",
    hint: "The requested assessment may have been deleted. Try generating a new one.",
  },
  UNAUTHORIZED: {
    title: "Access denied",
    hint: "You do not have permission to view this assessment. Contact your administrator.",
  },
};

export function ErrorState({ code, message, hint, onRetry }: ErrorStateProps) {
  const known = code ? ERROR_MESSAGES[code] : undefined;
  const displayTitle = known?.title ?? message;
  const displayHint = hint ?? known?.hint;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 animate-fade-in"
      style={{
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.35)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span
          role="img"
          aria-label="Warning"
          style={{ fontSize: "1.5rem", lineHeight: 1, flexShrink: 0, marginTop: 2 }}
        >
          ⚠️
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold" style={{ color: "#fff", fontSize: "0.9375rem" }}>
              {displayTitle}
            </p>
            {code && (
              <span
                className="font-mono text-xs px-2 py-0.5 rounded"
                style={{
                  background: "rgba(239,68,68,0.18)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.3)",
                  letterSpacing: "0.04em",
                }}
              >
                {code}
              </span>
            )}
          </div>

          {displayHint && (
            <p className="text-sm" style={{ color: "#8ab4d4", lineHeight: 1.6 }}>
              {displayHint}
            </p>
          )}
        </div>
      </div>

      {/* Retry button */}
      {onRetry && (
        <div>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
            style={{
              background: "transparent",
              border: "1px solid rgba(239,68,68,0.45)",
              color: "#f87171",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M1 4v6h6M23 20v-6h-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
