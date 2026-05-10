"use client";

import type { PostureTargetState } from "@/types/posture-roadmap";

interface Props {
  data: PostureTargetState;
  targetFramework: string;
  onChangeFramework: (fw: string) => void;
}

const FRAMEWORK_OPTIONS = [
  { value: "CMMC_L2", label: "CMMC Level 2" },
  { value: "CMMC_L1", label: "CMMC Level 1" },
  { value: "NIST", label: "NIST CSF 2.0" },
  { value: "CIS", label: "CIS Controls v8" },
  { value: "HIPAA", label: "HIPAA Security Rule" },
  { value: "SOC2", label: "SOC 2" },
];

function DistanceMeter({
  current,
  required,
}: {
  current: number;
  required: number;
}) {
  const met = current >= required;
  const pct = Math.min(100, Math.round((current / required) * 100));
  const color = met ? "#22c55e" : pct >= 75 ? "#eab308" : pct >= 50 ? "#f97316" : "#ef4444";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span style={{ color: "#8ab4d4" }}>Current maturity</span>
        <span className="font-bold" style={{ color }}>
          {current} / {required}
        </span>
      </div>
      <div className="relative h-3 rounded-full" style={{ background: "rgba(176,196,222,0.12)" }}>
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
        <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>
          Maturity score meets the requirement for this framework.
        </p>
      ) : (
        <p className="text-xs" style={{ color: "#8ab4d4" }}>
          Need <strong style={{ color }}>{required - current} more points</strong> to reach readiness threshold.
        </p>
      )}
    </div>
  );
}

function ControlStatusBadge({ status }: { status: "met" | "gap" }) {
  return (
    <span
      className="text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
      style={
        status === "met"
          ? { background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }
          : { background: "#ef444422", color: "#ef4444", border: "1px solid #ef444444" }
      }
    >
      {status === "met" ? "Met" : "Gap"}
    </span>
  );
}

export function TargetStatePanel({ data, targetFramework, onChangeFramework }: Props) {
  const readinessPercent =
    data.requiredControlCount > 0
      ? Math.round((data.metControlCount / data.requiredControlCount) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Framework selector */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.2)",
        }}
      >
        <p className="sw-kicker mb-3">Target Framework</p>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChangeFramework(opt.value)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                targetFramework === opt.value
                  ? {
                      background: "linear-gradient(135deg, #1565c0, #1e88e5)",
                      color: "#fff",
                      border: "1px solid #29b6f6",
                    }
                  : {
                      background: "rgba(176,196,222,0.08)",
                      color: "#8ab4d4",
                      border: "1px solid rgba(176,196,222,0.2)",
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
        className="rounded-2xl p-6 space-y-5"
        style={{
          background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
          border: "1px solid rgba(41,182,246,0.2)",
        }}
      >
        <div>
          <p className="sw-kicker mb-1">Readiness Overview</p>
          <p className="text-2xl font-bold" style={{ color: "#fff" }}>
            {data.targetFrameworkDisplayName}
          </p>
        </div>

        <DistanceMeter current={data.currentMaturityScore} required={data.requiredMaturityScore} />

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Controls",
              value: data.requiredControlCount,
              color: "#8ab4d4",
            },
            {
              label: "Controls Met",
              value: data.metControlCount,
              color: "#22c55e",
            },
            {
              label: "Control Gaps",
              value: data.currentGapCount,
              color: data.currentGapCount > 0 ? "#ef4444" : "#22c55e",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 text-center"
              style={{ background: "rgba(176,196,222,0.07)", border: "1px solid rgba(176,196,222,0.12)" }}
            >
              <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-xs mt-1" style={{ color: "#8ab4d4" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Control progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: "#8ab4d4" }}>Controls covered</span>
            <span className="font-bold" style={{ color: readinessPercent >= 80 ? "#22c55e" : "#eab308" }}>
              {readinessPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(176,196,222,0.12)" }}>
            <div
              className="h-2 rounded-full"
              style={{
                width: `${readinessPercent}%`,
                background:
                  readinessPercent >= 80
                    ? "linear-gradient(90deg,#15803d,#22c55e)"
                    : "linear-gradient(90deg,#92400e,#eab308)",
                transition: "width 0.8s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Key controls */}
      {data.keyRequiredControls.length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
            border: "1px solid rgba(41,182,246,0.2)",
          }}
        >
          <p className="sw-kicker mb-4">Key Required Controls</p>
          <div className="space-y-2">
            {data.keyRequiredControls.map((ctrl) => (
              <div
                key={ctrl.controlCode}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  background: "rgba(176,196,222,0.06)",
                  border: "1px solid rgba(176,196,222,0.1)",
                }}
              >
                <span
                  className="text-xs font-mono font-bold shrink-0"
                  style={{ color: "#29b6f6", minWidth: "80px" }}
                >
                  {ctrl.controlCode}
                </span>
                <span className="text-sm flex-1 truncate" style={{ color: "#e6edf5" }}>
                  {ctrl.controlTitle}
                </span>
                <ControlStatusBadge status={ctrl.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
