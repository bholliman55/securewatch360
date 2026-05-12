import type { SimulatedEvent } from "../types";

/**
 * Abstraction over SecureWatch360’s ingestion path (Inngest, internal APIs, or test doubles).
 * Production lab usage MUST wire a mock sink in CI unless explicitly pointed at staging.
 */
export interface OrchestrationEventSink {
  /** Publish one synthetic structured event — no network payloads that perform attacks. */
  publish(event: SimulatedEvent): Promise<{ ok: boolean; correlationId?: string }>;

  flush?(): Promise<void>;
}
