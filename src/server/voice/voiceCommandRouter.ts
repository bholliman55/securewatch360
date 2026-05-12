/**
 * Voice command router.
 *
 * Thin glue between the gateway and the {@link VOICE_ADAPTERS} registry.
 * Each adapter encapsulates its own dispatch (Inngest events, direct
 * service calls, or stubs); the router is responsible for:
 *
 *   1. Selecting the right adapter for an intent.
 *   2. Building the per-call {@link VoiceAdapterContext}.
 *   3. Translating the unified {@link AdapterResult} back into the existing
 *      `RouteResult` shape the gateway has consumed since day one.
 *
 * Keeping the `RouteResult` contract stable means the gateway pipeline,
 * audit hooks, and existing gateway tests do not need to change as new
 * intents are added.
 */

import { randomUUID } from "crypto";

import { inngest } from "@/inngest/client";
import { VOICE_ADAPTERS } from "./agentAdapters";
import type {
  AdapterData,
  AdapterInngestEvent,
  AdapterResult,
  VoiceAdapter,
  VoiceAdapterContext,
} from "./agentAdapters/types";
import type { ClassifiedVoiceCommand, VoiceCommandSlots } from "./types";

export interface RouteContext {
  tenantId: string;
  actorUserId: string;
  conversationId: string;
  voiceCommandId: string;
}

export type RouterInngestEvent = AdapterInngestEvent;

export interface RouteResult {
  /** Events the adapter dispatched, by name only (for audit). */
  events: ReadonlyArray<{ name: string; data: Record<string, unknown> }>;
  /** Sentence safe to read aloud — never contains secrets. */
  spokenResponse: string;
  /** Slot keys the adapter could not fill; non-empty triggers a clarification. */
  missingSlots: ReadonlyArray<keyof VoiceCommandSlots>;
  /** Free-form payload the adapter wants to expose upstream. */
  data?: AdapterResult["data"];
  /** Suggested follow-up actions for the speaker. */
  nextActions?: AdapterResult["nextActions"];
  /** True when the adapter explicitly asked for a follow-up turn. */
  requiresFollowUp?: AdapterResult["requiresFollowUp"];
}

export interface RouterDeps {
  /**
   * Default Inngest dispatcher. Adapters get this via their context unless
   * they declare an override; we keep it here so the router stays the single
   * place tests can substitute the real Inngest client.
   */
  sendEvents: (events: AdapterInngestEvent[]) => Promise<void>;
  /** Stable id factory — overridable in tests. */
  newId: () => string;
  /** Optional override for the intent → adapter mapping. */
  adapters?: Record<string, VoiceAdapter>;
  /**
   * Optional context augmentation hook. Adapters can read service overrides
   * from `context.deps` via narrowed casts (see `ContextWithDeps` patterns
   * in each adapter file). Production code leaves this unset.
   */
  augmentContext?: (context: VoiceAdapterContext) => VoiceAdapterContext;
}

const defaultDeps: RouterDeps = {
  sendEvents: async (events) => {
    if (events.length === 0) return;
    await inngest.send(events);
  },
  newId: () => randomUUID(),
};

function adapterDataAsRouterData(data: AdapterResult["data"]): AdapterData {
  return (data ?? {}) as AdapterData;
}

function buildAdapterContext(
  command: ClassifiedVoiceCommand,
  context: RouteContext,
  deps: RouterDeps,
  capturedEvents: AdapterInngestEvent[],
  forwardSend: boolean,
): VoiceAdapterContext {
  // Wrap the configured `sendEvents` so we can capture full payloads for
  // the RouteResult while still letting the real client receive them.
  // For dry-runs (`buildRoute`) the wrapping does NOT forward.
  const capturingSend = async (events: AdapterInngestEvent[]) => {
    capturedEvents.push(...events);
    if (forwardSend) {
      await deps.sendEvents(events);
    }
  };

  const baseContext: VoiceAdapterContext = {
    tenantId: context.tenantId,
    actorUserId: context.actorUserId,
    conversationId: context.conversationId,
    voiceCommandId: context.voiceCommandId,
    slots: command.slots,
    deps: {
      inngestSend: capturingSend,
      newId: deps.newId,
    },
  };

  return deps.augmentContext ? deps.augmentContext(baseContext) : baseContext;
}

async function dispatchThroughAdapter(
  command: ClassifiedVoiceCommand,
  context: RouteContext,
  deps: RouterDeps,
  forwardSend: boolean,
): Promise<RouteResult> {
  const adapters = deps.adapters ?? VOICE_ADAPTERS;
  const adapter = adapters[command.intent];
  if (!adapter) {
    return {
      events: [],
      spokenResponse: `No voice adapter is registered for intent ${command.intent}.`,
      missingSlots: [],
      data: { payload: { error: "no_adapter" } },
      requiresFollowUp: true,
    };
  }

  const captured: AdapterInngestEvent[] = [];
  const adapterContext = buildAdapterContext(command, context, deps, captured, forwardSend);
  const result = await adapter(adapterContext);

  const data = adapterDataAsRouterData(result.data);
  const missingSlots: ReadonlyArray<keyof VoiceCommandSlots> = data.missingSlots ?? [];

  return {
    events: captured,
    spokenResponse: result.spokenSummary,
    missingSlots,
    data: result.data,
    nextActions: result.nextActions,
    requiresFollowUp: result.requiresFollowUp,
  };
}

/**
 * Dispatch the command through the adapter registry. Tests can override
 * `deps.adapters` to substitute hand-rolled adapters per intent.
 */
export async function routeVoiceCommand(
  command: ClassifiedVoiceCommand,
  context: RouteContext,
  deps: RouterDeps = defaultDeps,
): Promise<RouteResult> {
  return dispatchThroughAdapter(command, context, deps, /* forwardSend */ true);
}

/**
 * Pure dry-run that runs the adapter against an injected context whose
 * `inngestSend` collects events instead of dispatching them. Used by the
 * gateway's `needs_confirmation` branch to *describe* what would happen.
 */
export async function buildRoute(
  command: ClassifiedVoiceCommand,
  context: RouteContext,
  deps: RouterDeps = defaultDeps,
): Promise<RouteResult> {
  return dispatchThroughAdapter(command, context, deps, /* forwardSend */ false);
}
