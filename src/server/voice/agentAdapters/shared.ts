/**
 * Shared helpers used by every voice adapter.
 *
 * Centralizes the default Inngest dispatch and id generation so individual
 * adapters stay focused on their domain logic. Tests can pass overrides via
 * `VoiceAdapterContext.deps`; production calls fall through to the real
 * Inngest client.
 */

import { randomUUID } from "crypto";
import { inngest } from "@/inngest/client";

import type {
  AdapterDeps,
  AdapterInngestEvent,
  AdapterInngestSend,
} from "./types";

const realInngestSend: AdapterInngestSend = async (events) => {
  if (events.length === 0) return;
  await inngest.send(events);
};

export function resolveInngestSend(deps: AdapterDeps | undefined): AdapterInngestSend {
  return deps?.inngestSend ?? realInngestSend;
}

export function resolveNewId(deps: AdapterDeps | undefined): () => string {
  return deps?.newId ?? randomUUID;
}

/**
 * Tiny utility — wraps {@link AdapterInngestEvent} list construction so tests
 * can compare the shape without recomputing it inline.
 */
export function makeEvents(events: AdapterInngestEvent[]): AdapterInngestEvent[] {
  return events;
}
