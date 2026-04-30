import type { ParsedCommand } from "./intentSchema";
import type { RoutedResult } from "./commandRouter";

interface FormatOptions {
  command: ParsedCommand;
  routed?: RoutedResult;
  requiresApproval?: boolean;
  guardReason?: string;
  error?: string;
}

export function formatResponse(opts: FormatOptions): string {
  const { command, routed, requiresApproval, guardReason, error } = opts;

  if (error) {
    return `Unable to process your request: ${error}`;
  }

  if (requiresApproval) {
    return (
      guardReason ??
      `Action "${command.intent}" requires approval before it can be executed. ` +
        `A request has been logged and is awaiting authorization.`
    );
  }

  if (!routed) {
    return `Command was parsed but not routed.`;
  }

  const { scanId, triggeredEvents } = routed;
  const params = command.parameters as Record<string, unknown>;

  switch (command.intent) {
    case "run_scan":
      return (
        `Vulnerability scan initiated (scan ID: ${scanId}). ` +
        `Results will be available in the findings dashboard once complete.`
      );

    case "get_status":
      return `Status query dispatched (scan ID: ${scanId}). Results will appear shortly.`;

    case "get_compliance": {
      const framework = params.framework ? ` for ${String(params.framework).toUpperCase()}` : "";
      return `Compliance status check${framework} initiated (scan ID: ${scanId}).`;
    }

    case "get_risks": {
      const sev = params.severity ? ` ${String(params.severity).toUpperCase()}` : "";
      return `${sev} risk query dispatched (scan ID: ${scanId}). Risk register will be updated.`;
    }

    case "summarize_alerts":
      return `Alert summarization started (scan ID: ${scanId}). A summary will be ready shortly.`;

    case "trigger_remediation":
      return `Remediation action queued (scan ID: ${scanId}).`;

    case "get_external_intelligence": {
      const domain = params.domain ? String(params.domain) : "the target domain";
      const agentCount = triggeredEvents.length;
      return (
        `External intelligence scan started for ${domain} ` +
        `(${agentCount} agent${agentCount !== 1 ? "s" : ""} dispatched, scan ID: ${scanId}). ` +
        `Findings will appear in External Assets and OSINT Events once collection is complete.`
      );
    }

    default:
      return `Command dispatched (scan ID: ${scanId}).`;
  }
}
