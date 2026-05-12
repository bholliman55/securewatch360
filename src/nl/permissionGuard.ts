import type { ParsedNLCommand } from "./nlTypes";

// Intents that always require human approval before being routed to Inngest
const APPROVAL_REQUIRED_INTENTS = new Set(["trigger_remediation"]);

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export function checkPermission(command: ParsedNLCommand): GuardResult {
  if (APPROVAL_REQUIRED_INTENTS.has(command.intent) || command.requiresApproval) {
    return {
      allowed: false,
      reason: `Intent "${command.intent}" requires explicit approval before execution.`,
    };
  }

  if (command.confidence < 0.4) {
    return {
      allowed: false,
      reason: `Command confidence ${command.confidence.toFixed(2)} is below threshold. Please rephrase your request.`,
    };
  }

  return { allowed: true };
}
