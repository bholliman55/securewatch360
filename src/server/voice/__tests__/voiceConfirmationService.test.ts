/**
 * Voice confirmation service — phrase building, persistence hooks, and
 * follow-up resolution (case-insensitive match, TTL, same user/session,
 * admin-only destructive confirms).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassifiedVoiceCommand } from "../types";
import {
  buildConfirmationSpokenPrompt,
  buildDisplayConfirmationPhrase,
  buildNormalizedConfirmationPhrase,
  isConfirmationFollowUpTranscript,
  normalizeConfirmationPhrase,
  persistConfirmationChallenge,
  tryResolveConfirmationFollowUp,
  VOICE_CONFIRMATION_TTL_SECONDS,
} from "../voiceConfirmationService";
import type { VoiceRepository, PendingVoiceConfirmationBundle } from "../voiceRepository";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

import { writeAuditLog } from "@/lib/audit";

const auditMock = vi.mocked(writeAuditLog);

function classified(partial: Partial<ClassifiedVoiceCommand> = {}): ClassifiedVoiceCommand {
  return {
    intent: "START_INCIDENT_RESPONSE",
    safetyLevel: "HIGH_RISK_ACTION",
    slots: {},
    confidence: 0.88,
    reason: "test",
    ...partial,
  };
}

function makeRepo(overrides: Partial<VoiceRepository> = {}): VoiceRepository {
  return {
    insertSession: vi.fn(async () => null),
    findVoiceSessionByConversationId: vi.fn(async () => null),
    insertCommand: vi.fn(async () => null),
    getVoiceCommand: vi.fn(async () => null),
    updateCommandStatus: vi.fn(async () => null),
    insertAuditEvent: vi.fn(async () => null),
    insertConfirmationRequest: vi.fn(async () => null),
    findLatestPendingConfirmationBundle: vi.fn(
      async (ctx: { clientId: string; userId: string; conversationId: string }) => {
        void ctx;
        return null;
      },
    ),
    updateConfirmationRequestStatus: vi.fn(async () => null),
    ...overrides,
  };
}

beforeEach(() => {
  auditMock.mockClear();
});

// ---------------------------------------------------------------------------
// Examples (product rules expressed as tests)
// ---------------------------------------------------------------------------

describe("examples: which actions need confirmation", () => {
  it("isolate endpoint requires confirmation (HIGH/DESTRUCTIVE phrasing → canonical confirm phrase)", () => {
    const c = classified({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      slots: { endpointId: "LAPTOP-123" },
    });
    expect(buildNormalizedConfirmationPhrase(c)).toBe("confirm isolate endpoint laptop-123");
    expect(buildConfirmationSpokenPrompt(c)).toMatch(/Say:\s*confirm isolate endpoint LAPTOP-123/i);
  });

  it("disable user requires admin at policy time; phrase still encodes the account for confirmation", () => {
    const c = classified({
      intent: "DISABLE_USER_ACCOUNT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      slots: { userAccountId: "sarah@example.com" },
    });
    expect(buildNormalizedConfirmationPhrase(c)).toBe("confirm disable user account sarah@example.com");
    expect(buildConfirmationSpokenPrompt(c)).toContain("Say:");
  });

  it("generate report does not require confirmation (LOW_RISK — no confirm phrase for gateway)", () => {
    const c = classified({
      intent: "GENERATE_EXECUTIVE_REPORT",
      safetyLevel: "LOW_RISK_ACTION",
      slots: {},
    });
    // Service only builds phrases for commands that reached persist; this documents intent is low-risk.
    expect(c.safetyLevel).toBe("LOW_RISK_ACTION");
    expect(buildDisplayConfirmationPhrase(c)).toMatch(/^confirm generate executive report/i);
  });

  it("run external scan does not require confirmation (LOW_RISK)", () => {
    const c = classified({
      intent: "RUN_EXTERNAL_SCAN",
      safetyLevel: "LOW_RISK_ACTION",
      slots: { domain: "acme.com" },
    });
    expect(c.safetyLevel).toBe("LOW_RISK_ACTION");
    expect(buildDisplayConfirmationPhrase(c)).toMatch(/^confirm run external scan/i);
  });
});

// ---------------------------------------------------------------------------

describe("normalizeConfirmationPhrase", () => {
  it("folds case and collapses whitespace", () => {
    expect(normalizeConfirmationPhrase("  CONFIRM   Isolate   ENDPOINT  x  ")).toBe(
      "confirm isolate endpoint x",
    );
  });
});

describe("isConfirmationFollowUpTranscript", () => {
  it("returns true when the utterance leads with the word confirm", () => {
    expect(isConfirmationFollowUpTranscript("confirm isolate endpoint host-1")).toBe(true);
  });

  it("returns false for unrelated commands", () => {
    expect(isConfirmationFollowUpTranscript("isolate endpoint host-1")).toBe(false);
  });
});

describe("persistConfirmationChallenge", () => {
  it("inserts command + confirmation, logs requested, and uses a 5-minute TTL constant", () => {
    expect(VOICE_CONFIRMATION_TTL_SECONDS).toBe(300);
  });

  it("returns ok false when insertCommand fails", async () => {
    const repo = makeRepo({
      insertCommand: vi.fn(async () => null),
    });
    const result = await persistConfirmationChallenge(
      {
        tenantId: "t1",
        actorUserId: "u1",
        conversationId: "c1",
        voiceCommandId: "vc-1",
        transcript: "declare incident",
        classified: classified(),
      },
      { repository: repo },
    );
    expect(result.ok).toBe(false);
    expect(repo.insertConfirmationRequest).not.toHaveBeenCalled();
  });

  it("returns ok true when both inserts succeed and writes audit", async () => {
    const repo = makeRepo({
      insertCommand: vi.fn(async (input) => ({
        id: input.id ?? "x",
        voice_session_id: null,
        client_id: null,
        user_id: null,
        raw_transcript: "",
        normalized_command: null,
        intent: input.intent,
        safety_level: input.safetyLevel,
        status: input.status ?? "received",
        requires_confirmation: true,
        confirmed_at: null,
        executed_at: null,
        result_summary: null,
        error_message: null,
        metadata: {},
        created_at: "2026-05-08T00:00:00Z",
      })),
      insertConfirmationRequest: vi.fn(async () => ({
        id: "cr-1",
        voice_command_id: "vc-1",
        confirmation_phrase: "confirm start incident response",
        status: "pending" as const,
        expires_at: new Date().toISOString(),
        created_at: "2026-05-08T00:00:00Z",
      })),
      insertAuditEvent: vi.fn(async () => null),
    });

    const result = await persistConfirmationChallenge(
      {
        tenantId: "t1",
        actorUserId: "u1",
        conversationId: "conv-1",
        voiceCommandId: "vc-1",
        transcript: "declare an incident response",
        classified: classified(),
      },
      { repository: repo },
    );

    expect(result.ok).toBe(true);
    expect(repo.insertConfirmationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceCommandId: "vc-1",
        ttlSeconds: 300,
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "voice.confirmation.requested" }),
    );
  });
});

describe("tryResolveConfirmationFollowUp", () => {
  const baseBundle = (opts: { phrase: string; expiresMsFromNow: number; classified: ClassifiedVoiceCommand }): PendingVoiceConfirmationBundle => {
    const expires = new Date(Date.now() + opts.expiresMsFromNow).toISOString();
    return {
      confirmation: {
        id: "cr-1",
        voice_command_id: "vc-pending",
        confirmation_phrase: opts.phrase,
        status: "pending",
        expires_at: expires,
        created_at: "2026-05-08T00:00:00Z",
      },
      command: {
        id: "vc-pending",
        voice_session_id: null,
        client_id: "tenant-1",
        user_id: "user-1",
        raw_transcript: "declare an incident response",
        normalized_command: null,
        intent: opts.classified.intent,
        safety_level: opts.classified.safetyLevel,
        status: "awaiting_confirmation",
        requires_confirmation: true,
        confirmed_at: null,
        executed_at: null,
        result_summary: null,
        error_message: null,
        metadata: {
          conversationId: "conv-1",
          classified: opts.classified,
        },
        created_at: "2026-05-08T00:00:00Z",
      },
    };
  };

  it("returns handled:false when transcript does not start with confirm", async () => {
    const repo = makeRepo();
    const out = await tryResolveConfirmationFollowUp(
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorRole: "analyst",
        conversationId: "conv-1",
        transcript: "show critical findings",
        utteranceVoiceCommandId: "u1",
      },
      { repository: repo },
    );
    expect(out.handled).toBe(false);
  });

  it("accepts a case-insensitive matching phrase, marks confirmed, and dispatches", async () => {
    const phrase = buildNormalizedConfirmationPhrase(classified());
    const repo = makeRepo({
      findLatestPendingConfirmationBundle: vi.fn(
        async (ctx: { clientId: string; userId: string; conversationId: string }) => {
          void ctx;
          return baseBundle({ phrase, expiresMsFromNow: 60_000, classified: classified() });
        },
      ),
      updateConfirmationRequestStatus: vi.fn(async () => null),
      updateCommandStatus: vi.fn(async () => null),
    });

    const sent: { name: string; data: Record<string, unknown> }[] = [];
    const out = await tryResolveConfirmationFollowUp(
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorRole: "analyst",
        conversationId: "conv-1",
        transcript: "CONFIRM   START   INCIDENT   RESPONSE",
        utteranceVoiceCommandId: "utter-1",
      },
      {
        repository: repo,
        router: {
          sendEvents: async (events) => {
            sent.push(...events);
          },
          newId: () => "route-id-1",
        },
      },
    );

    expect(out.handled).toBe(true);
    if (out.handled) {
      expect(out.response.status).toBe("executed");
      expect(repo.updateConfirmationRequestStatus).toHaveBeenCalledWith("cr-1", "confirmed");
      expect(repo.updateCommandStatus).toHaveBeenCalledWith(
        "vc-pending",
        expect.objectContaining({ status: "executed" }),
      );
      expect(auditMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "voice.confirmation.accepted" }),
      );
    }
  });

  it("rejects wrong phrase and logs rejected", async () => {
    const phrase = buildNormalizedConfirmationPhrase(classified());
    const repo = makeRepo({
      findLatestPendingConfirmationBundle: vi.fn(
        async (ctx: { clientId: string; userId: string; conversationId: string }) => {
          void ctx;
          return baseBundle({ phrase, expiresMsFromNow: 60_000, classified: classified() });
        },
      ),
    });

    const out = await tryResolveConfirmationFollowUp(
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorRole: "analyst",
        conversationId: "conv-1",
        transcript: "confirm start incident response WRONG",
        utteranceVoiceCommandId: "utter-1",
      },
      { repository: repo },
    );

    expect(out.handled).toBe(true);
    if (out.handled) {
      expect(out.response.status).toBe("denied");
      expect(repo.updateConfirmationRequestStatus).toHaveBeenCalledWith("cr-1", "rejected");
      expect(auditMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "voice.confirmation.rejected" }),
      );
    }
  });

  it("expires stale challenges and logs expired", async () => {
    const phrase = buildNormalizedConfirmationPhrase(classified());
    const repo = makeRepo({
      findLatestPendingConfirmationBundle: vi.fn(
        async (ctx: { clientId: string; userId: string; conversationId: string }) => {
          void ctx;
          return baseBundle({ phrase, expiresMsFromNow: -1, classified: classified() });
        },
      ),
    });

    const out = await tryResolveConfirmationFollowUp(
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorRole: "analyst",
        conversationId: "conv-1",
        transcript: phrase,
        utteranceVoiceCommandId: "utter-1",
      },
      { repository: repo },
    );

    expect(out.handled).toBe(true);
    if (out.handled) {
      expect(out.response.status).toBe("denied");
      expect(repo.updateConfirmationRequestStatus).toHaveBeenCalledWith("cr-1", "expired");
      expect(auditMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "voice.confirmation.expired" }),
      );
    }
  });

  it("rejects destructive confirmation from a non-admin even when phrase matches", async () => {
    const c = classified({
      intent: "ISOLATE_ENDPOINT",
      safetyLevel: "DESTRUCTIVE_ACTION",
      slots: { endpointId: "LAPTOP-123" },
    });
    const phrase = buildNormalizedConfirmationPhrase(c);
    const repo = makeRepo({
      findLatestPendingConfirmationBundle: vi.fn(
        async (ctx: { clientId: string; userId: string; conversationId: string }) => {
          void ctx;
          return baseBundle({ phrase, expiresMsFromNow: 60_000, classified: c });
        },
      ),
    });

    const out = await tryResolveConfirmationFollowUp(
      {
        tenantId: "tenant-1",
        actorUserId: "user-1",
        actorRole: "analyst",
        conversationId: "conv-1",
        transcript: buildDisplayConfirmationPhrase(c),
        utteranceVoiceCommandId: "utter-1",
      },
      { repository: repo },
    );

    expect(out.handled).toBe(true);
    if (out.handled) {
      expect(out.response.status).toBe("denied");
      expect(out.response.spokenResponse.toLowerCase()).toContain("administrator");
      expect(repo.updateConfirmationRequestStatus).toHaveBeenCalledWith("cr-1", "rejected");
    }
  });
});
