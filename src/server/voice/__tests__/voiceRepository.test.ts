import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createVoiceRepository } from "../voiceRepository";

// ---------------------------------------------------------------------------
// Test harness — a hand-rolled Supabase builder mock that records every call.
// ---------------------------------------------------------------------------

interface InsertCall {
  table: string;
  values: Record<string, unknown>;
}

interface UpdateCall {
  table: string;
  values: Record<string, unknown>;
  filter: { column: string; value: unknown };
}

function makeSupabaseMock(
  responder: (op: "insert" | "update", table: string, values: Record<string, unknown>) =>
    | { data: Record<string, unknown>; error: null }
    | { data: null; error: { message: string } },
) {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];

  const fromMock = vi.fn((table: string) => {
    return {
      insert: (values: Record<string, unknown>) => {
        insertCalls.push({ table, values });
        const result = responder("insert", table, values);
        return {
          select: () => ({
            single: async () => result,
          }),
        };
      },
      update: (values: Record<string, unknown>) => {
        return {
          eq: (column: string, value: unknown) => {
            updateCalls.push({ table, values, filter: { column, value } });
            const result = responder("update", table, values);
            return {
              select: () => ({
                single: async () => result,
              }),
            };
          },
        };
      },
    };
  });

  const client = { from: fromMock } as unknown as SupabaseClient;
  return { client, insertCalls, updateCalls, fromMock };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe("voiceRepository", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("insertCommand", () => {
    it("inserts a voice_commands row with mapped column names", async () => {
      const { client, insertCalls } = makeSupabaseMock(() => ({
        data: {
          id: "cmd-1",
          voice_session_id: "sess-1",
          client_id: "tenant-1",
          user_id: "user-1",
          raw_transcript: "isolate the endpoint host-42",
          normalized_command: null,
          intent: "ISOLATE_ENDPOINT",
          safety_level: "DESTRUCTIVE_ACTION",
          status: "received",
          requires_confirmation: true,
          confirmed_at: null,
          executed_at: null,
          result_summary: null,
          error_message: null,
          metadata: {},
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      const row = await repo.insertCommand({
        voiceSessionId: "sess-1",
        clientId: "tenant-1",
        userId: "user-1",
        rawTranscript: "isolate the endpoint host-42",
        intent: "ISOLATE_ENDPOINT",
        safetyLevel: "DESTRUCTIVE_ACTION",
        requiresConfirmation: true,
      });

      expect(row).not.toBeNull();
      expect(row?.id).toBe("cmd-1");
      expect(row?.intent).toBe("ISOLATE_ENDPOINT");

      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0].table).toBe("voice_commands");
      expect(insertCalls[0].values).toMatchObject({
        voice_session_id: "sess-1",
        client_id: "tenant-1",
        user_id: "user-1",
        raw_transcript: "isolate the endpoint host-42",
        intent: "ISOLATE_ENDPOINT",
        safety_level: "DESTRUCTIVE_ACTION",
        status: "received",
        requires_confirmation: true,
      });
    });

    it("returns null and logs on Supabase error rather than throwing", async () => {
      const { client } = makeSupabaseMock(() => ({
        data: null,
        error: { message: "rls violation" },
      }));
      const repo = createVoiceRepository(client);

      const row = await repo.insertCommand({
        rawTranscript: "show critical findings",
        intent: "SHOW_CRITICAL_FINDINGS",
        safetyLevel: "READ_ONLY",
      });

      expect(row).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("insertAuditEvent", () => {
    it("inserts a voice_audit_events row with the correct shape", async () => {
      const { client, insertCalls } = makeSupabaseMock(() => ({
        data: {
          id: "evt-1",
          voice_session_id: null,
          voice_command_id: "cmd-1",
          client_id: "tenant-1",
          user_id: "user-1",
          event_type: "voice.command.received",
          event_payload: { intent: "SHOW_CRITICAL_FINDINGS" },
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      const row = await repo.insertAuditEvent({
        voiceCommandId: "cmd-1",
        clientId: "tenant-1",
        userId: "user-1",
        eventType: "voice.command.received",
        eventPayload: { intent: "SHOW_CRITICAL_FINDINGS" },
      });

      expect(row?.id).toBe("evt-1");
      expect(insertCalls[0].table).toBe("voice_audit_events");
      expect(insertCalls[0].values).toMatchObject({
        voice_command_id: "cmd-1",
        client_id: "tenant-1",
        user_id: "user-1",
        event_type: "voice.command.received",
        event_payload: { intent: "SHOW_CRITICAL_FINDINGS" },
      });
    });

    it("defaults event_payload to an empty object", async () => {
      const { client, insertCalls } = makeSupabaseMock(() => ({
        data: {
          id: "evt-2",
          voice_session_id: null,
          voice_command_id: null,
          client_id: null,
          user_id: null,
          event_type: "voice.session.opened",
          event_payload: {},
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      await repo.insertAuditEvent({ eventType: "voice.session.opened" });

      expect(insertCalls[0].values.event_payload).toEqual({});
    });
  });

  describe("insertConfirmationRequest", () => {
    it("inserts a confirmation request and computes expires_at when omitted", async () => {
      const { client, insertCalls } = makeSupabaseMock(() => ({
        data: {
          id: "req-1",
          voice_command_id: "cmd-1",
          confirmation_phrase: "confirm",
          status: "pending",
          expires_at: "2026-05-08T00:02:00Z",
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      const fakeNow = Date.parse("2026-05-08T00:00:00Z");
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(fakeNow);

      try {
        const row = await repo.insertConfirmationRequest({
          voiceCommandId: "cmd-1",
          confirmationPhrase: "confirm",
          ttlSeconds: 120,
        });

        expect(row?.id).toBe("req-1");
        expect(insertCalls[0].table).toBe("voice_confirmation_requests");
        expect(insertCalls[0].values).toMatchObject({
          voice_command_id: "cmd-1",
          confirmation_phrase: "confirm",
          status: "pending",
        });
        expect(insertCalls[0].values.expires_at).toBe("2026-05-08T00:02:00.000Z");
      } finally {
        dateSpy.mockRestore();
      }
    });

    it("respects an explicit expires_at when provided", async () => {
      const { client, insertCalls } = makeSupabaseMock(() => ({
        data: {
          id: "req-2",
          voice_command_id: "cmd-2",
          confirmation_phrase: "confirm",
          status: "pending",
          expires_at: "2030-01-01T00:00:00Z",
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      await repo.insertConfirmationRequest({
        voiceCommandId: "cmd-2",
        confirmationPhrase: "confirm",
        expiresAt: "2030-01-01T00:00:00Z",
      });

      expect(insertCalls[0].values.expires_at).toBe("2030-01-01T00:00:00Z");
    });
  });

  describe("updateCommandStatus", () => {
    it("updates status, executed_at, and result_summary atomically", async () => {
      const { client, updateCalls } = makeSupabaseMock(() => ({
        data: {
          id: "cmd-1",
          voice_session_id: null,
          client_id: "tenant-1",
          user_id: "user-1",
          raw_transcript: "show critical findings",
          normalized_command: null,
          intent: "SHOW_CRITICAL_FINDINGS",
          safety_level: "READ_ONLY",
          status: "executed",
          requires_confirmation: false,
          confirmed_at: null,
          executed_at: "2026-05-08T00:00:01Z",
          result_summary: "Pulled 3 critical findings.",
          error_message: null,
          metadata: {},
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      const row = await repo.updateCommandStatus("cmd-1", {
        status: "executed",
        executedAt: "2026-05-08T00:00:01Z",
        resultSummary: "Pulled 3 critical findings.",
      });

      expect(row?.status).toBe("executed");
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].table).toBe("voice_commands");
      expect(updateCalls[0].filter).toEqual({ column: "id", value: "cmd-1" });
      expect(updateCalls[0].values).toMatchObject({
        status: "executed",
        executed_at: "2026-05-08T00:00:01Z",
        result_summary: "Pulled 3 critical findings.",
      });
      // Optional fields that were not supplied should not be in the patch.
      expect(updateCalls[0].values).not.toHaveProperty("error_message");
      expect(updateCalls[0].values).not.toHaveProperty("confirmed_at");
    });

    it("captures error_message when transitioning to failed", async () => {
      const { client, updateCalls } = makeSupabaseMock(() => ({
        data: {
          id: "cmd-1",
          voice_session_id: null,
          client_id: null,
          user_id: null,
          raw_transcript: "isolate endpoint",
          normalized_command: null,
          intent: "ISOLATE_ENDPOINT",
          safety_level: "DESTRUCTIVE_ACTION",
          status: "failed",
          requires_confirmation: true,
          confirmed_at: null,
          executed_at: null,
          result_summary: null,
          error_message: "downstream timeout",
          metadata: {},
          created_at: "2026-05-08T00:00:00Z",
        },
        error: null,
      }));
      const repo = createVoiceRepository(client);

      await repo.updateCommandStatus("cmd-1", {
        status: "failed",
        errorMessage: "downstream timeout",
      });

      expect(updateCalls[0].values).toMatchObject({
        status: "failed",
        error_message: "downstream timeout",
      });
    });

    it("returns null when Supabase reports an error", async () => {
      const { client } = makeSupabaseMock(() => ({
        data: null,
        error: { message: "row not found" },
      }));
      const repo = createVoiceRepository(client);

      const row = await repo.updateCommandStatus("cmd-missing", { status: "denied" });
      expect(row).toBeNull();
    });
  });
});
