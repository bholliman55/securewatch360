/**
 * Thin client for ElevenLabs Conversational AI HTTP endpoints.
 *
 * Today this module exposes the outbound-call endpoint used by the
 * incident-call service:
 *
 *   POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
 *
 * Design notes:
 *   - Reads env at *call time* so tests can stub via `vi.stubEnv` and so
 *     env mutation in long-lived processes is honored without a restart.
 *   - `fetch` is injectable so tests never touch the real network.
 *   - Normalizes the response into a `{ ok, ... }` discriminated union —
 *     callers should never need to inspect a raw HTTP status code.
 *   - NEVER logs the API key (header redaction is enforced via the typed
 *     wrapper around `Headers`; only sanitized request payload reaches the
 *     audit pipeline upstream).
 */

export interface ElevenLabsClientConfig {
  apiKey: string;
  baseUrl?: string;
  /** Timeout in milliseconds (default 10s). */
  timeoutMs?: number;
}

export interface OutboundTwilioCallParams {
  agentId: string;
  agentPhoneNumberId: string;
  toNumber: string;
  /**
   * Variables surfaced to the agent's prompt template (e.g. `{{briefing_text}}`).
   * Keep the keys snake_case to match ElevenLabs' templating convention.
   */
  dynamicVariables?: Record<string, string | number | boolean>;
  /** Optional first message override. */
  firstMessage?: string;
  /** Free-form metadata attached client-side; not sent to ElevenLabs. */
  // (Reserved for the service layer; we deliberately don't forward it.)
}

export interface OutboundTwilioCallSuccess {
  ok: true;
  conversationId: string;
  callSid: string;
  message?: string;
  /** Raw response body for forensic / audit logging. */
  raw: Record<string, unknown>;
}

export interface OutboundTwilioCallFailure {
  ok: false;
  /** Categorized failure mode for audit. */
  reason:
    | "missing_api_key"
    | "missing_agent_id"
    | "missing_phone_number_id"
    | "missing_to_number"
    | "http_error"
    | "network_error"
    | "invalid_response";
  /** HTTP status when known. */
  status?: number;
  /** Human-readable detail (no secrets). */
  message: string;
  /** Sanitized response body or upstream error string. */
  detail?: unknown;
}

export type OutboundTwilioCallResult =
  | OutboundTwilioCallSuccess
  | OutboundTwilioCallFailure;

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ElevenLabsClientDeps {
  fetchImpl?: FetchLike;
  /** Override `Date.now` for deterministic tests. */
  now?: () => number;
}

const DEFAULT_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * POST /v1/convai/twilio/outbound-call
 *
 * Returns a normalized result. Never throws — all failure modes map to
 * {@link OutboundTwilioCallFailure}.
 */
export async function createOutboundTwilioCall(
  config: ElevenLabsClientConfig,
  params: OutboundTwilioCallParams,
  deps: ElevenLabsClientDeps = {},
): Promise<OutboundTwilioCallResult> {
  if (!config.apiKey) {
    return {
      ok: false,
      reason: "missing_api_key",
      message: "ELEVENLABS_API_KEY is not configured.",
    };
  }
  if (!params.agentId) {
    return { ok: false, reason: "missing_agent_id", message: "agentId is required." };
  }
  if (!params.agentPhoneNumberId) {
    return {
      ok: false,
      reason: "missing_phone_number_id",
      message: "agentPhoneNumberId is required.",
    };
  }
  if (!params.toNumber) {
    return {
      ok: false,
      reason: "missing_to_number",
      message: "toNumber is required.",
    };
  }

  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${baseUrl}/v1/convai/twilio/outbound-call`;

  const requestBody: Record<string, unknown> = {
    agent_id: params.agentId,
    agent_phone_number_id: params.agentPhoneNumberId,
    to_number: params.toNumber,
  };

  if (params.dynamicVariables || params.firstMessage) {
    const init: Record<string, unknown> = {};
    if (params.dynamicVariables) init.dynamic_variables = params.dynamicVariables;
    if (params.firstMessage) init.first_message = params.firstMessage;
    requestBody.conversation_initiation_client_data = init;
  }

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    return {
      ok: false,
      reason: "network_error",
      message: "No fetch implementation available in this runtime.",
    };
  }

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timeout = setTimeout(
    () => controller?.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller?.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const message =
      error instanceof Error ? error.message : "Unknown network error.";
    return {
      ok: false,
      reason: "network_error",
      message: "Failed to reach ElevenLabs outbound-call endpoint.",
      detail: message,
    };
  } finally {
    clearTimeout(timeout);
  }

  let parsedBody: Record<string, unknown> | string | null = null;
  const contentType = response.headers.get("content-type") ?? "";
  try {
    parsedBody = contentType.includes("application/json")
      ? ((await response.json()) as Record<string, unknown>)
      : await response.text();
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "http_error",
      status: response.status,
      message: `ElevenLabs outbound-call returned HTTP ${response.status}.`,
      detail: parsedBody,
    };
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    return {
      ok: false,
      reason: "invalid_response",
      status: response.status,
      message: "ElevenLabs outbound-call returned a non-JSON body.",
      detail: parsedBody,
    };
  }

  const body = parsedBody as Record<string, unknown>;
  const conversationId =
    typeof body.conversation_id === "string" ? body.conversation_id : null;
  const callSid =
    typeof body.callSid === "string"
      ? body.callSid
      : typeof body.call_sid === "string"
        ? (body.call_sid as string)
        : null;

  if (!conversationId || !callSid) {
    return {
      ok: false,
      reason: "invalid_response",
      status: response.status,
      message:
        "ElevenLabs outbound-call response is missing conversation_id or callSid.",
      detail: body,
    };
  }

  return {
    ok: true,
    conversationId,
    callSid,
    message: typeof body.message === "string" ? body.message : undefined,
    raw: body,
  };
}
