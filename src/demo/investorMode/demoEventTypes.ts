/**
 * Type definitions for the SecureWatch360 investor demo simulation.
 *
 * The investor demo replays a deterministic, fictional ransomware-precursor
 * scenario against a synthetic MSP client (Acme Dental). Nothing in this
 * module is permitted to touch real customer infrastructure, real malware,
 * or real endpoints.
 *
 * The shapes here are intentionally explicit — the replay engine, sinks,
 * metrics service, and report service all share these types as the single
 * source of truth.
 */

/**
 * Closed list of every event the demo can emit. Adding a new step to the
 * scenario requires extending this union and the timeline in `demoScenario.ts`.
 */
export const DEMO_EVENT_TYPES = [
  "demo_started",
  "detection_powershell",
  "detection_file_access",
  "detection_credential_access",
  "agent_classification",
  "agent_correlation",
  "agent_compliance_check",
  "containment_recommended",
  "voice_confirmation_requested",
  "admin_confirmation_received",
  "endpoint_isolated",
  "ticket_created",
  "executive_report_generated",
  "business_impact_summary_generated",
  "demo_completed",
] as const;

export type DemoEventType = (typeof DEMO_EVENT_TYPES)[number];

/**
 * Severity tier for an event — drives UI color, alerting, and metrics roll-ups.
 * Mirrors the same scale used in `src/types/finding.ts` so audiences see a
 * consistent vocabulary across the product.
 */
export const DEMO_EVENT_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type DemoEventSeverity = (typeof DEMO_EVENT_SEVERITIES)[number];

/**
 * Who emitted the event — useful for the timeline UI to render
 * different lanes (system, agent, admin, voice).
 */
export const DEMO_EVENT_ACTORS = ["system", "agent", "admin", "voice"] as const;
export type DemoEventActor = (typeof DEMO_EVENT_ACTORS)[number];

/**
 * Stable label for the SecureWatch agent that "owned" the event,
 * for cases where `actor === "agent"`. Matches the existing agent
 * numbering used elsewhere in the codebase.
 */
export type DemoAgentLabel =
  | "agent2-correlation"
  | "agent3-compliance"
  | "agent5-classification";

/**
 * Single event in the demo timeline. The same shape is persisted
 * to Supabase (when configured) and held in memory for local dev.
 */
export interface DemoEvent {
  /** Unique event id (UUID v4 generated client-side). */
  id: string;
  /** Run id — every `start()` call produces a fresh run. */
  demoRunId: string;
  /** Scenario id — currently always `"ransomware-precursor-acme-dental"`. */
  scenarioId: string;
  /** 1-indexed step within the timeline. */
  step: number;
  /** Seconds since `demo_started` was emitted. */
  offsetSeconds: number;
  /** Wall-clock ISO timestamp when the event was emitted. */
  emittedAt: string;
  /** Closed-list event type — drives narrative + UI rendering. */
  type: DemoEventType;
  /** Lane label (system / agent / admin / voice). */
  actor: DemoEventActor;
  /** Optional agent identity when `actor === "agent"`. */
  agent?: DemoAgentLabel;
  /** Short investor-friendly headline (one line). */
  title: string;
  /** Investor-friendly explanation, suitable for spoken/screen readout. */
  narrative: string;
  /** Analyst-friendly detail with the fabricated technical context. */
  technicalDetail: string;
  /** Severity tier — drives color and metrics aggregation. */
  severity: DemoEventSeverity;
  /** Free-form structured payload (asset id, user id, ticket number, etc.). */
  payload: Record<string, unknown>;
}

/**
 * Definition of a single timeline step before it is materialised into a
 * runtime `DemoEvent` (id + emittedAt are added by the replay engine).
 */
export type DemoTimelineStep = Omit<
  DemoEvent,
  "id" | "demoRunId" | "scenarioId" | "emittedAt"
>;

/**
 * Sink contract — anything that can persist demo events and answer
 * "give me the events for this run". The replay engine and metrics
 * service depend only on this interface, never on Supabase directly,
 * so unit tests use a trivial in-memory implementation.
 */
export interface DemoEventSink {
  /** Persist a single event. Must never throw on transient failures. */
  persist(event: DemoEvent): Promise<void>;
  /** Return all events for a run, in step order. */
  list(demoRunId: string): Promise<DemoEvent[]>;
  /** Delete every event for the given scenario across all runs. */
  reset(scenarioId: string): Promise<void>;
  /** Human-readable identifier, surfaced in `/api/demo/health` etc. */
  readonly kind: "supabase" | "memory";
}
