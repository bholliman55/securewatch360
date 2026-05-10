"use client";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading posture assessment..." }: LoadingStateProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, #07111f 0%, #112d4e 60%, #1565c020 100%)",
          border: "1px solid rgba(41,182,246,0.25)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded animate-pulse" style={{ background: "rgba(41,182,246,0.2)" }} />
            <div className="h-7 w-48 rounded animate-pulse" style={{ background: "rgba(176,196,222,0.1)" }} />
            <div className="h-4 w-80 rounded animate-pulse" style={{ background: "rgba(176,196,222,0.07)" }} />
          </div>
          <div className="flex gap-4 flex-wrap sm:flex-nowrap">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="text-center px-4 py-2 rounded-xl h-16 w-20 animate-pulse"
                style={{ background: "rgba(176,196,222,0.08)", border: "1px solid rgba(176,196,222,0.15)" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tab nav skeleton */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "rgba(176,196,222,0.07)", border: "1px solid rgba(176,196,222,0.12)" }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-1 h-10 rounded-lg animate-pulse"
            style={{ background: "rgba(176,196,222,0.08)" }}
          />
        ))}
      </div>

      {/* Main content skeleton + spinner */}
      <div
        className="rounded-2xl p-8 flex flex-col items-center gap-6"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.18)",
        }}
      >
        {/* Radar / scan animation */}
        <div className="relative" style={{ width: 72, height: 72 }}>
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            style={{ animation: "spin 2s linear infinite" }}
          >
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              stroke="rgba(41,182,246,0.15)"
              strokeWidth="4"
            />
            <path
              d="M36 8 A28 28 0 0 1 64 36"
              fill="none"
              stroke="#29b6f6"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(41,182,246,0.12) 0%, transparent 70%)",
            }}
          />
        </div>

        <p className="text-sm font-medium" style={{ color: "#8ab4d4" }}>
          {message}
        </p>

        {/* Executive summary card skeletons */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl h-24 animate-pulse"
              style={{ background: "rgba(176,196,222,0.08)" }}
            />
          ))}
        </div>

        {/* Wide bar skeletons */}
        <div className="w-full space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-full rounded animate-pulse" style={{ height: 40, background: "rgba(176,196,222,0.06)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
