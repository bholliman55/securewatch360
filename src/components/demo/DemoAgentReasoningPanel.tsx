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
  return (
    <section
      aria-labelledby="agent-reasoning-title"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-baseline justify-between">
        <h2
          id="agent-reasoning-title"
          className="text-base font-semibold text-gray-900"
        >
          Agent reasoning
        </h2>
        {reasoning?.agent_name && (
          <span className="text-xs text-gray-500">
            {reasoning.agent_name}
          </span>
        )}
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Current autonomous action
            </h3>
            <ActionStatusBadge status={currentAction.status} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900">
            {currentAction.action_label}
          </p>
          {currentAction.result_summary && (
            <p className="mt-1 text-sm text-gray-600">
              {currentAction.result_summary}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-800">{value}</dd>
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

const STATUS_BADGE: Record<DemoActionRow["status"], string> = {
  pending: "bg-gray-100 text-gray-600 border-gray-200",
  awaiting_confirmation: "bg-amber-50 text-amber-800 border-amber-200",
  confirmed: "bg-sky-50 text-sky-700 border-sky-200",
  executed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

function ActionStatusBadge({
  status,
}: {
  status: DemoActionRow["status"];
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_BADGE[status]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
