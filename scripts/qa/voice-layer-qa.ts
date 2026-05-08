/**
 * SecureWatch360 voice-layer QA harness.
 *
 * Exercises the full ElevenLabs voice gateway pipeline end-to-end —
 * classification → policy → routing → confirmation — WITHOUT any
 * outbound network call (no ElevenLabs, no Inngest, no Supabase).
 *
 * Strategy:
 *   1. Pre-set fake env vars BEFORE any voice module is imported, so
 *      `getSupabaseAdminClient()` constructs a (never-used) client.
 *   2. Replace `globalThis.fetch` with a recorder that returns 201 for
 *      every Supabase REST hit (so `writeAuditLog`'s parallel write to
 *      `audit_logs` succeeds quietly without a real DB round-trip).
 *   3. Mutate the singleton `voiceRepository` so every read/write is
 *      backed by an in-memory recorder. This is what we assert against
 *      to verify "audit events were created."
 *   4. Provide an in-memory `RouterDeps` that captures Inngest events
 *      instead of dispatching, and an `augmentContext` hook that injects
 *      mocked compliance/risk services for read-only intents.
 *
 * Exit code: 0 if all expectations pass, 1 otherwise.
 */

// ---------------------------------------------------------------------------
// 1. Env priming — must happen BEFORE any project module import.
// ---------------------------------------------------------------------------

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://qa-stub.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "qa-fake-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "qa-fake-service-role";
process.env.INNGEST_DEV ||= "true";
process.env.INNGEST_EVENT_KEY ||= "qa-fake-event-key";

// ---------------------------------------------------------------------------
// 2. Global fetch recorder — silently accepts Supabase REST writes.
// ---------------------------------------------------------------------------

const realFetch: typeof fetch | undefined = globalThis.fetch;
const supabaseFetchHits: { url: string; method: string }[] = [];

globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = (init?.method ?? "GET").toUpperCase();

  if (url.includes("qa-stub.invalid") || url.includes("supabase.co")) {
    supabaseFetchHits.push({ url, method });
    return new Response(JSON.stringify({}), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }
  if (!realFetch) {
    throw new Error(`No fetch available for ${url}`);
  }
  return realFetch(input as Parameters<typeof fetch>[0], init);
}) as typeof fetch;

// ---------------------------------------------------------------------------
// 3. Late-bound voice imports.
// ---------------------------------------------------------------------------

import { handleVoiceCommand } from "../../src/server/voice/voiceGateway";
import { voiceRepository } from "../../src/server/voice/voiceRepository";
import type {
  VoiceCommandRow,
  VoiceConfirmationRequestRow,
  VoiceSessionRow,
  VoiceConfirmationStatus,
  PendingVoiceConfirmationBundle,
} from "../../src/server/voice/voiceRepository";
import type {
  VoiceGatewayResponse,
  VoiceGatewayStatus,
  VoiceIntent,
  CommandSafetyLevel,
} from "../../src/server/voice/types";
import type { RouterDeps } from "../../src/server/voice/voiceCommandRouter";
import type {
  AdapterInngestEvent,
  VoiceAdapterContext,
} from "../../src/server/voice/agentAdapters/types";
import type { TenantRole } from "../../src/lib/tenant-guard";

// ---------------------------------------------------------------------------
// 4. In-memory repository recorder. Patches the singleton's methods.
// ---------------------------------------------------------------------------

interface AuditEventRecord {
  voiceCommandId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}

interface RepositoryState {
  sessions: VoiceSessionRow[];
  commands: Map<string, VoiceCommandRow>;
  confirmations: Map<string, VoiceConfirmationRequestRow>;
  auditEvents: AuditEventRecord[];
}

const repoState: RepositoryState = {
  sessions: [],
  commands: new Map(),
  confirmations: new Map(),
  auditEvents: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

Object.assign(voiceRepository, {
  async insertSession(input: {
    clientId?: string | null;
    userId?: string | null;
    elevenlabsConversationId?: string | null;
    channel?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<VoiceSessionRow | null> {
    const row: VoiceSessionRow = {
      id: genId("session"),
      client_id: input.clientId ?? null,
      user_id: input.userId ?? null,
      elevenlabs_conversation_id: input.elevenlabsConversationId ?? null,
      channel: input.channel ?? "elevenlabs",
      status: input.status ?? "active",
      started_at: nowIso(),
      ended_at: null,
      metadata: input.metadata ?? {},
    };
    repoState.sessions.push(row);
    return row;
  },

  async findVoiceSessionByConversationId(
    conversationId: string,
  ): Promise<VoiceSessionRow | null> {
    return (
      repoState.sessions.find(
        (s) => s.elevenlabs_conversation_id === conversationId,
      ) ?? null
    );
  },

  async insertCommand(input: {
    id?: string;
    clientId?: string | null;
    userId?: string | null;
    voiceSessionId?: string | null;
    rawTranscript: string;
    intent: VoiceIntent;
    safetyLevel: CommandSafetyLevel;
    status?: string;
    requiresConfirmation?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<VoiceCommandRow | null> {
    const id = input.id ?? genId("cmd");
    const row: VoiceCommandRow = {
      id,
      voice_session_id: input.voiceSessionId ?? null,
      client_id: input.clientId ?? null,
      user_id: input.userId ?? null,
      raw_transcript: input.rawTranscript,
      normalized_command: null,
      intent: input.intent,
      safety_level: input.safetyLevel,
      status: (input.status ?? "received") as VoiceCommandRow["status"],
      requires_confirmation: Boolean(input.requiresConfirmation),
      confirmed_at: null,
      executed_at: null,
      result_summary: null,
      error_message: null,
      metadata: input.metadata ?? {},
      created_at: nowIso(),
    };
    repoState.commands.set(id, row);
    return row;
  },

  async getVoiceCommand(commandId: string): Promise<VoiceCommandRow | null> {
    return repoState.commands.get(commandId) ?? null;
  },

  async updateCommandStatus(
    commandId: string,
    input: {
      status: VoiceCommandRow["status"];
      resultSummary?: string | null;
      errorMessage?: string | null;
      confirmedAt?: string | null;
      executedAt?: string | null;
    },
  ): Promise<VoiceCommandRow | null> {
    const existing = repoState.commands.get(commandId);
    if (!existing) return null;
    const updated: VoiceCommandRow = {
      ...existing,
      status: input.status,
      result_summary: input.resultSummary ?? existing.result_summary,
      error_message: input.errorMessage ?? existing.error_message,
      confirmed_at: input.confirmedAt ?? existing.confirmed_at,
      executed_at: input.executedAt ?? existing.executed_at,
    };
    repoState.commands.set(commandId, updated);
    return updated;
  },

  async insertAuditEvent(input: {
    voiceCommandId?: string | null;
    eventType: string;
    eventPayload?: Record<string, unknown>;
  }) {
    repoState.auditEvents.push({
      voiceCommandId: input.voiceCommandId ?? null,
      eventType: input.eventType,
      payload: input.eventPayload ?? {},
    });
    return {
      id: genId("evt"),
      voice_session_id: null,
      voice_command_id: input.voiceCommandId ?? null,
      client_id: null,
      user_id: null,
      event_type: input.eventType,
      event_payload: input.eventPayload ?? {},
      created_at: nowIso(),
    };
  },

  async insertConfirmationRequest(input: {
    voiceCommandId: string;
    confirmationPhrase: string;
    ttlSeconds?: number;
    expiresAt?: string;
  }): Promise<VoiceConfirmationRequestRow | null> {
    const id = genId("conf");
    const expiresAt =
      input.expiresAt ??
      new Date(Date.now() + (input.ttlSeconds ?? 300) * 1000).toISOString();
    const row: VoiceConfirmationRequestRow = {
      id,
      voice_command_id: input.voiceCommandId,
      confirmation_phrase: input.confirmationPhrase,
      status: "pending",
      expires_at: expiresAt,
      created_at: nowIso(),
    };
    repoState.confirmations.set(id, row);
    return row;
  },

  async findLatestPendingConfirmationBundle(input: {
    clientId: string;
    userId: string;
    conversationId: string;
  }): Promise<PendingVoiceConfirmationBundle | null> {
    const candidates = Array.from(repoState.confirmations.values())
      .filter((c) => c.status === "pending")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    for (const conf of candidates) {
      const cmd = repoState.commands.get(conf.voice_command_id);
      if (!cmd) continue;
      if (cmd.client_id !== input.clientId) continue;
      if (cmd.user_id !== input.userId) continue;
      const cmdConv = (cmd.metadata as Record<string, unknown> | null)
        ?.conversationId;
      if (cmdConv && cmdConv !== input.conversationId) continue;
      return { confirmation: conf, command: cmd };
    }
    return null;
  },

  async updateConfirmationRequestStatus(
    confirmationId: string,
    status: VoiceConfirmationStatus,
  ): Promise<VoiceConfirmationRequestRow | null> {
    const existing = repoState.confirmations.get(confirmationId);
    if (!existing) return null;
    const updated: VoiceConfirmationRequestRow = { ...existing, status };
    repoState.confirmations.set(confirmationId, updated);
    return updated;
  },
});

// ---------------------------------------------------------------------------
// 5. Mocked compliance/risk services + Inngest event recorder.
// ---------------------------------------------------------------------------

const capturedInngestEvents: AdapterInngestEvent[] = [];

const mockComplianceDeps = {
  runComplianceStatus: async () => ({
    scanId: genId("scan"),
    framework: undefined,
    controls: { total: 100, passing: 92, failing: 6, notApplicable: 2 },
    posture: "strong" as const,
    completedAt: new Date(),
  }),
  runRiskQuery: async () => ({
    scanId: genId("scan"),
    totalFindings: 3,
    bySeverity: { critical: 2, high: 1, medium: 0, low: 0 },
    topFindings: [
      {
        id: "qa-finding-1",
        title: "Public storage bucket exposes PHI",
        severity: "critical" as const,
      },
    ] as unknown as never,
    completedAt: new Date(),
  }),
};

const routerDeps: RouterDeps = {
  sendEvents: async (events) => {
    for (const e of events) capturedInngestEvents.push(e);
  },
  newId: () => genId("evt"),
  augmentContext: (ctx: VoiceAdapterContext): VoiceAdapterContext => ({
    ...ctx,
    // Adapters narrow-cast to read these (`ContextWithDeps` pattern).
    complianceDeps: mockComplianceDeps,
  } as VoiceAdapterContext),
};

// ---------------------------------------------------------------------------
// 6. QA assertion helpers.
// ---------------------------------------------------------------------------

interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

interface CaseReport {
  id: string;
  title: string;
  transcript: string;
  status: VoiceGatewayStatus | "n/a";
  intent: VoiceIntent | "n/a";
  checks: CheckResult[];
  passed: boolean;
}

function check(
  label: string,
  predicate: boolean,
  detail?: string,
): CheckResult {
  return { label, ok: predicate, detail: predicate ? undefined : detail };
}

function snapshotAuditEventCount(): number {
  return repoState.auditEvents.length;
}

function snapshotInngestCount(): number {
  return capturedInngestEvents.length;
}

const baseRequest = {
  tenantId: "qa-client-acme-dental",
  conversationId: "qa-conversation-1",
};

async function dispatch(
  transcript: string,
  opts: {
    actorUserId: string;
    actorRole: TenantRole;
    conversationId?: string;
  },
): Promise<VoiceGatewayResponse> {
  return handleVoiceCommand(
    {
      transcript,
      tenantId: baseRequest.tenantId,
      actorUserId: opts.actorUserId,
      actorRole: opts.actorRole,
      conversationId: opts.conversationId ?? baseRequest.conversationId,
    },
    { router: routerDeps },
  );
}

// ---------------------------------------------------------------------------
// 7. Test cases.
// ---------------------------------------------------------------------------

async function runCases(): Promise<CaseReport[]> {
  const reports: CaseReport[] = [];

  const adminUser = "qa-admin-user";
  const analystUser = "qa-analyst-user";

  // ---- Case 1: external scan ------------------------------------------
  {
    const transcript = "Run an external scan for Acme Dental acmedental.com";
    const beforeAudit = snapshotAuditEventCount();
    const beforeEvents = snapshotInngestCount();
    const res = await dispatch(transcript, {
      actorUserId: analystUser,
      actorRole: "analyst",
    });
    const auditDelta = snapshotAuditEventCount() - beforeAudit;
    const eventDelta = snapshotInngestCount() - beforeEvents;
    reports.push({
      id: "case-1",
      title: 'CASE 1 — "Run an external scan for Acme Dental"',
      transcript,
      status: res.status,
      intent: res.intent,
      checks: [
        check(
          "intent === RUN_EXTERNAL_SCAN",
          res.intent === "RUN_EXTERNAL_SCAN",
          `got ${res.intent}`,
        ),
        check(
          "safety in {READ_ONLY, LOW_RISK_ACTION}",
          res.safetyLevel === "READ_ONLY" || res.safetyLevel === "LOW_RISK_ACTION",
          `got ${res.safetyLevel}`,
        ),
        check(
          "no confirmation required",
          res.status !== "needs_confirmation",
          `status=${res.status}`,
        ),
        check(
          "audit events created",
          auditDelta >= 2,
          `auditDelta=${auditDelta} (expected ≥2: received + resolved)`,
        ),
        check(
          "external discovery dispatched",
          eventDelta >= 1,
          `inngest events captured = ${eventDelta}`,
        ),
      ],
      passed: false,
    });
  }

  // ---- Case 2: critical findings (read-only) --------------------------
  {
    const transcript = "Show me critical findings for Acme Dental";
    const beforeAudit = snapshotAuditEventCount();
    const res = await dispatch(transcript, {
      actorUserId: analystUser,
      actorRole: "analyst",
    });
    const auditDelta = snapshotAuditEventCount() - beforeAudit;
    reports.push({
      id: "case-2",
      title: 'CASE 2 — "Show me critical findings for Acme Dental"',
      transcript,
      status: res.status,
      intent: res.intent,
      checks: [
        check(
          "intent === SHOW_CRITICAL_FINDINGS",
          res.intent === "SHOW_CRITICAL_FINDINGS",
          `got ${res.intent}`,
        ),
        check(
          "safety === READ_ONLY",
          res.safetyLevel === "READ_ONLY",
          `got ${res.safetyLevel}`,
        ),
        check(
          "no confirmation required",
          res.status !== "needs_confirmation",
          `status=${res.status}`,
        ),
        check(
          "audit events created",
          auditDelta >= 2,
          `auditDelta=${auditDelta}`,
        ),
        check(
          "spoken response references findings",
          /finding|critical/i.test(res.spokenResponse),
          `spoken="${res.spokenResponse}"`,
        ),
      ],
      passed: false,
    });
  }

  // ---- Case 3: executive report --------------------------------------
  {
    const transcript = "Generate an executive report for Acme Dental";
    const beforeAudit = snapshotAuditEventCount();
    const beforeEvents = snapshotInngestCount();
    const res = await dispatch(transcript, {
      actorUserId: analystUser,
      actorRole: "analyst",
    });
    const auditDelta = snapshotAuditEventCount() - beforeAudit;
    const eventDelta = snapshotInngestCount() - beforeEvents;
    reports.push({
      id: "case-3",
      title: 'CASE 3 — "Generate an executive report for Acme Dental"',
      transcript,
      status: res.status,
      intent: res.intent,
      checks: [
        check(
          "intent === GENERATE_EXECUTIVE_REPORT",
          res.intent === "GENERATE_EXECUTIVE_REPORT",
          `got ${res.intent}`,
        ),
        check(
          "no confirmation required",
          res.status !== "needs_confirmation",
          `status=${res.status}`,
        ),
        check(
          "audit events created",
          auditDelta >= 2,
          `auditDelta=${auditDelta}`,
        ),
        check(
          "report generation event dispatched",
          eventDelta >= 1,
          `inngest events captured = ${eventDelta}`,
        ),
      ],
      passed: false,
    });
  }

  // ---- Case 4: isolate endpoint (challenge only — admin) -------------
  let isolateChallengeId: string | null = null;
  {
    const transcript = "Isolate endpoint LAPTOP-123";
    const beforeAudit = snapshotAuditEventCount();
    const beforeEvents = snapshotInngestCount();
    const beforeCommands = repoState.commands.size;
    const res = await dispatch(transcript, {
      actorUserId: adminUser,
      actorRole: "admin",
      conversationId: "qa-conv-isolate",
    });
    const auditDelta = snapshotAuditEventCount() - beforeAudit;
    const eventDelta = snapshotInngestCount() - beforeEvents;
    const commandsDelta = repoState.commands.size - beforeCommands;
    isolateChallengeId = res.voiceCommandId;
    reports.push({
      id: "case-4",
      title: 'CASE 4 — "Isolate endpoint LAPTOP-123" (challenge)',
      transcript,
      status: res.status,
      intent: res.intent,
      checks: [
        check(
          "intent === ISOLATE_ENDPOINT",
          res.intent === "ISOLATE_ENDPOINT",
          `got ${res.intent}`,
        ),
        check(
          "confirmation required",
          res.status === "needs_confirmation",
          `status=${res.status}`,
        ),
        check(
          "command stored as awaiting_confirmation",
          commandsDelta >= 1 &&
            Array.from(repoState.commands.values()).some(
              (c) =>
                c.intent === "ISOLATE_ENDPOINT" &&
                c.status === "awaiting_confirmation",
            ),
          `no awaiting_confirmation row visible (delta=${commandsDelta})`,
        ),
        check(
          "no isolation event dispatched yet",
          eventDelta === 0,
          `inngest events captured = ${eventDelta}`,
        ),
        check(
          "voice.confirmation.requested audit emitted",
          repoState.auditEvents.some(
            (e) => e.eventType === "voice.confirmation.requested",
          ),
          "no voice.confirmation.requested event recorded",
        ),
        check(
          "audit events created",
          auditDelta >= 2,
          `auditDelta=${auditDelta}`,
        ),
        check(
          "spoken prompt contains 'confirm isolate endpoint LAPTOP-123'",
          /confirm\s+isolate\s+endpoint\s+LAPTOP-123/i.test(res.spokenResponse),
          `spoken="${res.spokenResponse}"`,
        ),
      ],
      passed: false,
    });
  }
  void isolateChallengeId;

  // ---- Case 5: confirm isolate (admin → executes) ---------------------
  {
    const transcript = "Confirm isolate endpoint LAPTOP-123";
    const beforeAudit = snapshotAuditEventCount();
    const beforeEvents = snapshotInngestCount();
    const res = await dispatch(transcript, {
      actorUserId: adminUser,
      actorRole: "admin",
      conversationId: "qa-conv-isolate",
    });
    const auditDelta = snapshotAuditEventCount() - beforeAudit;
    const eventDelta = snapshotInngestCount() - beforeEvents;
    reports.push({
      id: "case-5",
      title: 'CASE 5 — "Confirm isolate endpoint LAPTOP-123" (admin)',
      transcript,
      status: res.status,
      intent: res.intent,
      checks: [
        check(
          "confirmation accepted (status === executed)",
          res.status === "executed",
          `status=${res.status}, intent=${res.intent}`,
        ),
        check(
          "voice.confirmation.accepted audit emitted",
          repoState.auditEvents.some(
            (e) => e.eventType === "voice.confirmation.accepted",
          ),
          "no voice.confirmation.accepted event recorded",
        ),
        check(
          "isolation event dispatched on confirm",
          eventDelta >= 1,
          `inngest events captured = ${eventDelta}`,
        ),
        check(
          "audit events created",
          auditDelta >= 2,
          `auditDelta=${auditDelta}`,
        ),
      ],
      passed: false,
    });
  }

  // ---- Case 6: disable user account (destructive, admin required) ----
  {
    const transcript = "Disable Sarah's account";
    const beforeAudit = snapshotAuditEventCount();

    // 6a. Non-admin (analyst) attempts the destructive action — must be denied.
    const denied = await dispatch(transcript, {
      actorUserId: analystUser,
      actorRole: "analyst",
      conversationId: "qa-conv-disable-deny",
    });

    // 6b. Admin re-issues — must move to needs_confirmation.
    const challenge = await dispatch(transcript, {
      actorUserId: adminUser,
      actorRole: "admin",
      conversationId: "qa-conv-disable-admin",
    });

    const auditDelta = snapshotAuditEventCount() - beforeAudit;
    reports.push({
      id: "case-6",
      title:
        'CASE 6 — "Disable Sarah\'s account" (destructive, admin + confirm required)',
      transcript,
      status: challenge.status,
      intent: challenge.intent,
      checks: [
        check(
          "intent === DISABLE_USER_ACCOUNT",
          challenge.intent === "DISABLE_USER_ACCOUNT",
          `got ${challenge.intent}`,
        ),
        check(
          "safety === DESTRUCTIVE_ACTION",
          challenge.safetyLevel === "DESTRUCTIVE_ACTION",
          `got ${challenge.safetyLevel}`,
        ),
        check(
          "non-admin denied",
          denied.status === "denied",
          `analyst got status=${denied.status}`,
        ),
        check(
          "admin gets needs_confirmation challenge",
          challenge.status === "needs_confirmation",
          `admin got status=${challenge.status}`,
        ),
        check(
          "follow-up prompt warns this is destructive",
          /destructive|administrator/i.test(challenge.followUpPrompt ?? ""),
          `followUpPrompt="${challenge.followUpPrompt ?? ""}"`,
        ),
        check(
          "audit events created across both attempts",
          auditDelta >= 4,
          `auditDelta=${auditDelta} (expect ≥4: 2× received + 2× resolved)`,
        ),
      ],
      passed: false,
    });
  }

  for (const r of reports) {
    r.passed = r.checks.every((c) => c.ok);
  }

  return reports;
}

// ---------------------------------------------------------------------------
// 8. Reporter.
// ---------------------------------------------------------------------------

function colorize(label: string, ok: boolean): string {
  if (process.env.NO_COLOR) return label;
  return ok ? `\x1b[32m${label}\x1b[0m` : `\x1b[31m${label}\x1b[0m`;
}

function printReport(reports: CaseReport[]): { passed: number; failed: number } {
  console.log("");
  console.log("============================================================");
  console.log("  SecureWatch360 Voice Layer QA — End-to-End (no ElevenLabs)");
  console.log("============================================================");
  let passed = 0;
  let failed = 0;
  for (const r of reports) {
    const banner = r.passed ? colorize("PASS", true) : colorize("FAIL", false);
    console.log("");
    console.log(`[${banner}] ${r.title}`);
    console.log(`        transcript: ${r.transcript}`);
    console.log(
      `        gateway:    intent=${r.intent}, status=${r.status}`,
    );
    for (const c of r.checks) {
      const tick = c.ok ? colorize("✓", true) : colorize("✗", false);
      const detail = c.ok ? "" : ` — ${c.detail ?? ""}`;
      console.log(`          ${tick} ${c.label}${detail}`);
    }
    if (r.passed) passed += 1;
    else failed += 1;
  }
  console.log("");
  console.log("------------------------------------------------------------");
  console.log(
    `  Summary: ${colorize(`${passed} passed`, true)} / ${
      failed === 0 ? "0 failed" : colorize(`${failed} failed`, false)
    } / ${reports.length} cases`,
  );
  console.log(
    `  Audit events captured (in-memory):   ${repoState.auditEvents.length}`,
  );
  console.log(
    `  Inngest events captured (in-memory): ${capturedInngestEvents.length}`,
  );
  console.log(
    `  Supabase REST hits intercepted:      ${supabaseFetchHits.length}`,
  );
  console.log("------------------------------------------------------------");
  return { passed, failed };
}

// ---------------------------------------------------------------------------
// 9. Main.
// ---------------------------------------------------------------------------

async function main() {
  const reports = await runCases();
  const summary = printReport(reports);
  if (summary.failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("[qa:voice] Fatal error in QA harness:", error);
  process.exit(1);
});
