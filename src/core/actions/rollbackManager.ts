import { randomUUID } from "node:crypto";
import type { ActionType } from "./action.schema";
import type { ActionHandlerResult } from "./actionRegistry";

export type RollbackExecutionResult = ActionHandlerResult & {
  meta?: { type: ActionType; correlationId: string };
};

type RollbackEntry = {
  tenantId: string;
  type: ActionType;
  correlationId: string;
  rollback: () => Promise<ActionHandlerResult>;
};

/**
 * In-process rollback hooks for actions that advertise {@link ActionDefinition.supportsRollback}.
 * For multi-node deployments, persist rollback descriptors externally instead of this map.
 */
export class RollbackManager {
  private readonly entries = new Map<string, RollbackEntry>();

  clearForTests(): void {
    this.entries.clear();
  }

  generateToken(): string {
    return randomUUID();
  }

  register(params: {
    token: string;
    tenantId: string;
    type: ActionType;
    correlationId: string;
    rollback: () => Promise<ActionHandlerResult>;
  }): void {
    this.entries.set(params.token, {
      tenantId: params.tenantId,
      type: params.type,
      correlationId: params.correlationId,
      rollback: params.rollback,
    });
  }

  async executeRollback(params: { token: string; tenantId: string }): Promise<RollbackExecutionResult> {
    const entry = this.entries.get(params.token);
    if (!entry || entry.tenantId !== params.tenantId) {
      return {
        ok: false,
        evidence: { reason: "rollback_token_invalid_or_tenant_mismatch" },
        meta: undefined,
      };
    }
    const meta = { type: entry.type, correlationId: entry.correlationId };
    const result = await entry.rollback();
    this.entries.delete(params.token);
    return { ...result, meta };
  }
}
