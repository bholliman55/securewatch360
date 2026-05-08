/**
 * Shared types for the voice → agent adapter layer.
 *
 * Adapters are the binding between a {@link VoiceIntent} and the actual
 * SecureWatch360 worker / service that does the work. Each adapter:
 *
 *   - takes a `VoiceAdapterContext` (tenant / user / slots / injectable deps)
 *   - either dispatches an Inngest event (async work) OR calls an existing
 *     service inline (read-only queries that need a fast spoken answer)
 *   - returns an {@link AdapterResult} the gateway can speak verbatim
 *
 * The unified return shape lets the router treat every intent the same way
 * and lets new intents plug in without modifying the gateway pipeline.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { VoiceCommandSlots } from "../types";

/** Single Inngest event the adapter wants the dispatcher to send. */
export interface AdapterInngestEvent {
  name: string;
  data: Record<string, unknown>;
}

/** Function signature for the injected Inngest send dependency. */
export type AdapterInngestSend = (events: AdapterInngestEvent[]) => Promise<void>;

/**
 * Per-call context. The router supplies this for every adapter invocation.
 * `deps` lets unit tests substitute Inngest / Supabase without standing up
 * any infrastructure.
 */
export interface VoiceAdapterContext {
  tenantId: string;
  actorUserId: string;
  conversationId: string;
  voiceCommandId: string;
  /** Slot values pulled out of the transcript by the classifier. */
  slots: VoiceCommandSlots;
  /** Confirmation flag (set by the policy guard / gateway). */
  confirmation?: boolean;
  /**
   * Optional dependency overrides — production code uses defaults,
   * tests inject mocks here.
   */
  deps?: AdapterDeps;
}

export interface AdapterDeps {
  inngestSend?: AdapterInngestSend;
  supabase?: SupabaseClient;
  /** Stable id factory; defaults to `crypto.randomUUID`. */
  newId?: () => string;
}

/**
 * Canonical adapter result. This is the contract the gateway speaks back to
 * the user. Adapters MUST NOT include API keys, webhook URLs, or service-role
 * tokens in any field — the gateway treats `spokenSummary` as user-readable.
 *
 * `data.dispatchedEvents` is an internal convenience: when an adapter fires
 * Inngest events, it lists the event names there so the router can surface
 * them in the audit trail without each adapter inventing its own field.
 */
export interface AdapterResult {
  success: boolean;
  spokenSummary: string;
  data?: AdapterData;
  nextActions?: string[];
  requiresFollowUp?: boolean;
}

/**
 * `data` is `unknown` per the spec, but we use this typed sub-shape inside
 * the project so callers can read `dispatchedEvents` / `missingSlots` safely
 * via a narrow cast (`result.data as AdapterData`). External consumers can
 * ignore it.
 */
export interface AdapterData {
  /** Inngest event names this adapter dispatched. */
  dispatchedEvents?: ReadonlyArray<string>;
  /** Slots the adapter needs but did not receive. */
  missingSlots?: ReadonlyArray<keyof VoiceCommandSlots>;
  /** Free-form payload the adapter wants to surface upstream. */
  payload?: unknown;
}

/** A voice adapter is just a function. */
export type VoiceAdapter = (context: VoiceAdapterContext) => Promise<AdapterResult>;
