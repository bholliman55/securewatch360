"use client";

/**
 * DemoAgentReasoningPanel — explains the reasoning behind the most recent
 * emitted timeline event, plus the *current autonomous action*.
 *
 * Per spec the reasoning panel shows:
 *   - what the agent saw
 *   - why it mattered
 *   - recommended action
 *   - confidence (if available)
 *
 * The "current autonomous action" surface lets the audience see what
 * SecureWatch is doing in response (`pending → awaiting_confirmation →
 * confirmed → executed`).
 */

import type {
  DemoActionRow,
  DemoAgentReasoningRow,
  DemoEventRow,
} from "@/demo/investorMode";

export interface DemoAgentReasoningPanelProps {
  latestEvent: DemoEventRow | null;
  reasoning: DemoAgentReasoningRow | null;
  currentAction: DemoActionRow | null;
}

export function DemoAgentReasoningPanel({
  latestEvent,
  reasoning,
  currentAction,
}: DemoAgentReasoningPanelProps): React.JSX.Element {
  const panelStyle: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(41,182,246,0.2)",
    background: "#0d1e33",
    padding: "1rem 1.1rem",
    boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
  };
  const kicker: React.CSSProperties = {
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
    fontSize: "0.75rem",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#8ab4d4",
  };
  return (
    <section aria-labelledby="agent-reasoning-title" style={panelStyle}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 id="agent-reasoning-title" style={{ ...kicker, margin: 0 }}>
          Agent Reasoning
        </h2>
        {reasoning?.agent_name && (
          <span style={{ fontSize: "0.72rem", color: "#29b6f6", fontWeight: 600 }}>
            {reasoning.agent_name}
          </span>
        )}
      </header>

      <div style={{ marginTop: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <ReasoningCell
          label="What the agent saw"
          value={latestEvent?.description ?? "Awaiting first event…"}
        />
        <ReasoningCell
          label="Why it mattered"
          value={reasoning?.reasoning_summary ?? "Reasoning will populate once the agent classifies an event."}
        />
        <ReasoningCell
          label="Recommended action"
          value={describeRecommendation(latestEvent, currentAction)}
        />
        <ReasoningCell
          label="Confidence"
          value={
            reasoning?.confidence != null
              ? `${Math.round((reasoning.confidence as number) * 100)}%`
              : "—"
          }
        />
      </div>

      {currentAction && (
        <div
          style={{
            marginTop: "1rem",
            borderRadius: 8,
            border: "1px solid rgba(41,182,246,0.25)",
            background: "rgba(41,182,246,0.06)",
            padding: "0.75rem 0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
            <h3 style={{ ...kicker, margin: 0 }}>Current Autonomous Action</h3>
            <ActionStatusBadge status={currentAction.status} />
          </div>
          <p style={{ marginTop: "0.45rem", fontSize: "0.85rem", fontWeight: 600, color: "#e2e8f0" }}>
            {currentAction.action_label}
          </p>
          {currentAction.result_summary && (
            <p style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "#8ab4d4", lineHeight: 1.4 }}>
              {currentAction.result_summary}
            </p>
          )}
          <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.72rem", color: "#8ab4d4" }}>
            <span>Safety: {humanizeSafety(currentAction.safety_level)}</span>
            {currentAction.requires_confirmation && (
              <span>
                {currentAction.confirmed
                  ? "Human confirmation: received"
                  : "Human confirmation: required"}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function ReasoningCell({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div>
      <dt
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#8ab4d4",
        }}
      >
        {label}
      </dt>
      <dd style={{ marginTop: "0.3rem", fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.45 }}>
        {value}
      </dd>
    </div>
  );
}

function describeRecommendation(
  event: DemoEventRow | null,
  action: DemoActionRow | null,
): string {
  if (!event && !action) {
    return "Awaiting first event…";
  }
  if (
    event &&
    (event.event_type === "containment_recommended" ||
      event.event_type === "voice_confirmation_requested")
  ) {
    return "Isolate LAPTOP-123 from the network, preserve forensic logs, and create a remediation ticket (simulated).";
  }
  if (action && action.action_type === "isolate_endpoint") {
    return action.action_label;
  }
  return "Continue monitoring; no autonomous action proposed yet.";
}

function humanizeSafety(level: DemoActionRow["safety_level"]): string {
  switch (level) {
    case "READ_ONLY":
      return "Read-only";
    case "LOW_RISK_ACTION":
      return "Low risk";
    case "HIGH_RISK_ACTION":
      return "High risk";
    case "DESTRUCTIVE_ACTION":
      return "Destructive";
    default:
      return level;
  }
}

const STATUS_BADGE_STYLE: Record<
  DemoActionRow["status"],
  { bg: string; color: string; border: string }
> = {
  pending: { bg: "rgba(176,196,222,0.08)", color: "#8ab4d4", border: "rgba(176,196,222,0.2)" },
  awaiting_confirmation: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  confirmed: { bg: "rgba(41,182,246,0.1)", color: "#29b6f6", border: "rgba(41,182,246,0.3)" },
  executed: { bg: "rgba(34,197,94,0.1)", color: "#22c55e", border: "rgba(34,197,94,0.3)" },
  failed: { bg: "rgba(248,113,113,0.1)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
  cancelled: { bg: "rgba(176,196,222,0.06)", color: "#8ab4d4", border: "rgba(176,196,222,0.15)" },
};

function ActionStatusBadge({
  status,
}: {
  status: DemoActionRow["status"];
}): React.JSX.Element {
  const s = STATUS_BADGE_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 9999,
        border: `1px solid ${s.border}`,
        background: s.bg,
        padding: "0.12rem 0.5rem",
        fontSize: "0.62rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: s.color,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
