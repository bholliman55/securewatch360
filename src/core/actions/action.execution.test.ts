import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { executeAction } from "./actionExecutor";
import { ActionAuditLogger } from "./actionAuditLogger";
import { RollbackManager } from "./rollbackManager";
import { createDefaultActionRegistry } from "./defaultActionHandlers";
import { actionTypeRequiresApproval } from "./action.schema";

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("action execution layer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("supports dry_run for high-risk actions without approval", async () => {
    const registry = createDefaultActionRegistry();
    const rollback = new RollbackManager();
    const audit = new ActionAuditLogger(null);

    const result = await executeAction(registry, rollback, audit, {
      tenant_id: TENANT,
      type: "isolate_endpoint",
      dry_run: true,
      correlation_id: randomUUID(),
      params: { endpoint_id: "ep-1" },
    });

    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.evidence.dry_run).toBe(true);
    expect(result.rollback_token).toBeUndefined();
  });

  it("blocks high-risk live execution without approval_reference", async () => {
    const registry = createDefaultActionRegistry();
    const rollback = new RollbackManager();
    const audit = new ActionAuditLogger(null);

    const result = await executeAction(registry, rollback, audit, {
      tenant_id: TENANT,
      type: "rotate_secret",
      dry_run: false,
      correlation_id: randomUUID(),
      params: { secret_id: "sec-1" },
    });

    expect(result.ok).toBe(false);
    expect(result.approval_required).toBe(true);
  });

  it("allows live high-risk execution when approval_reference is present", async () => {
    const registry = createDefaultActionRegistry();
    const rollback = new RollbackManager();
    const audit = new ActionAuditLogger(null);
    const correlationId = randomUUID();

    const result = await executeAction(registry, rollback, audit, {
      tenant_id: TENANT,
      type: "block_ip",
      dry_run: false,
      correlation_id: correlationId,
      approval_reference: "approval-ticket-99",
      params: { ip: "203.0.113.10" },
    });

    expect(result.ok).toBe(true);
    expect(result.rollback_token).toMatch(/^rb-block_ip-/);
  });

  it("registers rollback and can execute it with tenant scope", async () => {
    const registry = createDefaultActionRegistry();
    const rollback = new RollbackManager();
    const audit = new ActionAuditLogger(null);
    const correlationId = randomUUID();

    const result = await executeAction(registry, rollback, audit, {
      tenant_id: TENANT,
      type: "isolate_endpoint",
      dry_run: false,
      correlation_id: correlationId,
      approval_reference: "appr-1",
      params: {},
    });

    expect(result.rollback_token).toBeTruthy();
    const rb = await rollback.executeRollback({
      token: result.rollback_token!,
      tenantId: TENANT,
    });
    expect(rb.ok).toBe(true);
    expect(rb.evidence.isolation_released).toBe(true);
  });

  it("marks approval requirement consistently for gated action types", () => {
    expect(actionTypeRequiresApproval("create_ticket")).toBe(false);
    expect(actionTypeRequiresApproval("isolate_endpoint")).toBe(true);
  });
});
