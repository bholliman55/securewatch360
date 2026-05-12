export {
  ACTION_TYPES,
  ACTION_TYPES_REQUIRING_APPROVAL,
  actionExecutionInputSchema,
  actionExecutionResultSchema,
  actionTypeRequiresApproval,
  type ActionExecutionInput,
  type ActionExecutionResult,
  type ActionType,
} from "./action.schema";

export type {
  ActionDefinition,
  ActionHandlerContext,
  ActionHandlerResult,
  ActionRollbackContext,
} from "./actionRegistry";
export { ActionRegistry } from "./actionRegistry";

export { ActionAuditLogger, type ActionAuditPhase } from "./actionAuditLogger";

export { RollbackManager, type RollbackExecutionResult } from "./rollbackManager";

export { executeAction, executeRegisteredRollback } from "./actionExecutor";

export { createDefaultActionRegistry } from "./defaultActionHandlers";
