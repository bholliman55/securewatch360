import { describe, expect, it } from "vitest";
import { AuditHashChain } from "./auditHashChain";
import { signInternalEvent } from "./eventSigner";
import { NonceReplayGuard, verifyInternalEvent } from "./eventVerifier";
import { IdempotencyStore } from "./idempotency";
import { assertSameTenant, TenantAuthorizationError } from "./tenantAuthorization";

const SECRET = "unit-test-hmac-secret-at-least-32-chars!!";
const TENANT = "11111111-1111-4111-8111-111111111111";

describe("platform-security", () => {
  it("rejects invalid internal event signatures", () => {
    const replay = new NonceReplayGuard(60_000);
    const ev = signInternalEvent({
      secret: SECRET,
      tenant_id: TENANT,
      payload: { kind: "test" },
    });
    const tampered = { ...ev, signature: "00".repeat(32) };
    const v = verifyInternalEvent({
      secret: SECRET,
      envelope: tampered,
      replay,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad_signature");
  });

  it("blocks cross-tenant internal events", () => {
    const replay = new NonceReplayGuard(60_000);
    const ev = signInternalEvent({
      secret: SECRET,
      tenant_id: TENANT,
      payload: { x: 1 },
    });
    const v = verifyInternalEvent({
      secret: SECRET,
      envelope: ev,
      expected_tenant_id: "22222222-2222-4222-8222-222222222222",
      replay,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("tenant_mismatch");
  });

  it("rejects replayed internal events (nonce reuse)", () => {
    const replay = new NonceReplayGuard(60_000);
    const ev = signInternalEvent({
      secret: SECRET,
      tenant_id: TENANT,
      payload: { kind: "replay" },
      nonce: "fixed-nonce-for-replay-test-01",
    });
    const first = verifyInternalEvent({ secret: SECRET, envelope: ev, replay, expected_tenant_id: TENANT });
    expect(first.ok).toBe(true);
    const second = verifyInternalEvent({ secret: SECRET, envelope: ev, replay, expected_tenant_id: TENANT });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("replay_nonce");
  });

  it("handles duplicate idempotent requests safely", () => {
    const store = new IdempotencyStore<{ ok: boolean }>();
    const key = "idem:evt:1";
    const a = store.beginOrGet({ key, ttl_ms: 60_000 });
    expect(a.state).toBe("first");
    store.complete(key, { ok: true });
    const b = store.beginOrGet({ key, ttl_ms: 60_000 });
    expect(b.state).toBe("duplicate");
    expect(b.record.result).toEqual({ ok: true });
  });

  it("validates audit hash chain end-to-end", () => {
    const chain = new AuditHashChain();
    chain.append({ action: "login", user: "u1" });
    chain.append({ action: "policy_eval", id: "p1" });
    expect(chain.validate()).toBe(true);
    const recs = chain.getRecords();
    (recs[0] as { entry_hash: string }).entry_hash = "deadbeef";
    expect(chain.validate()).toBe(false);
  });

  it("assertSameTenant throws on mismatch", () => {
    expect(() => assertSameTenant(TENANT, "22222222-2222-4222-8222-222222222222")).toThrow(TenantAuthorizationError);
  });
});
