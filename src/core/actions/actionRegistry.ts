import type { ActionType } from "./action.schema";

export type ActionHandlerContext = {
  tenantId: string;
  dryRun: boolean;
  params: Record<string, unknown>;
  correlationId: string;
  actorUserId: string | null;
};

export type ActionHandlerResult = {
  ok: boolean;
  evidence: Record<string, unknown>;
  /** Present when the action can be rolled back and was not a dry run. */
  rollback_token?: string;
};

export type ActionRollbackContext = ActionHandlerContext & {
  rollback_token: string;
};

export interface ActionDefinition {
  readonly type: ActionType;
  /** When true, non–dry-run executions must include `approval_reference` on the input. */
  readonly requiresApproval: boolean;
  /** When true, handler may return `rollback_token` for {@link RollbackManager}. */
  readonly supportsRollback: boolean;
  execute(ctx: ActionHandlerContext): Promise<ActionHandlerResult>;
  rollback?(ctx: ActionRollbackContext): Promise<ActionHandlerResult>;
}

/**
 * Registry of executable actions — core executor never switches on vendor; it only looks up handlers here.
 */
export class ActionRegistry {
  private readonly defs = new Map<ActionType, ActionDefinition>();

  register(definition: ActionDefinition): void {
    this.defs.set(definition.type, definition);
  }

  get(type: ActionType): ActionDefinition | undefined {
    return this.defs.get(type);
  }

  require(type: ActionType): ActionDefinition {
    const d = this.defs.get(type);
    if (!d) throw new Error(`No action registered for type "${type}"`);
    return d;
  }

  registeredTypes(): ActionType[] {
    return [...this.defs.keys()].sort((a, b) => a.localeCompare(b));
  }
}
