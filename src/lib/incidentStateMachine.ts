export const INCIDENT_STATES = [
  "open",
  "contained",
  "remediated",
  "validated",
  "rejoined",
] as const;

export type IncidentState = (typeof INCIDENT_STATES)[number];

export type IncidentLifecycleStep = {
  event: string;
  status: "pending" | "completed";
  details: string;
};

const ALLOWED_TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  open: ["contained"],
  contained: ["remediated"],
  remediated: ["validated"],
  validated: ["rejoined"],
  rejoined: [],
};

const COMPLETION_EVENTS_BY_STATE: Record<IncidentState, Set<string>> = {
  open: new Set(["incident.created"]),
  contained: new Set(["containment.started", "device.offline", "network.vlan.quarantine"]),
  remediated: new Set(["remediation.patch_or_rebuild"]),
  validated: new Set(["validation.started", "validation.completed"]),
  rejoined: new Set(["recovery.rejoin_requested", "recovery.rejoin_completed"]),
};

export function isIncidentState(value: string): value is IncidentState {
  return INCIDENT_STATES.includes(value as IncidentState);
}

export function canTransitionIncidentState(from: IncidentState, to: IncidentState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function completeLifecycleForState(
  lifecycle: IncidentLifecycleStep[],
  state: IncidentState
): IncidentLifecycleStep[] {
  const completionEvents = COMPLETION_EVENTS_BY_STATE[state];
  if (!completionEvents || completionEvents.size === 0) return lifecycle;

  return lifecycle.map((step) =>
    completionEvents.has(step.event)
      ? {
          ...step,
          status: "completed",
        }
      : step
  );
}

export function normalizeIncidentState(raw: unknown): IncidentState {
  if (typeof raw !== "string") return "open";
  const value = raw.trim().toLowerCase();
  return isIncidentState(value) ? value : "open";
}
