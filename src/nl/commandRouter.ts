import { randomUUID } from "crypto";
import { inngest } from "@/inngest/client";
import type { ParsedCommand, SupportedIntent } from "./intentSchema";

export interface RoutedResult {
  scanId: string;
  triggeredEvents: string[];
}

type InngestEvent = { name: string; data: Record<string, unknown> };

// Maps each intent to a factory that builds the Inngest event payload(s).
// Adding a new intent only requires adding an entry here — the router and API
// endpoint are otherwise unaware of agent details.
const INTENT_ROUTES: Record<
  SupportedIntent,
  (command: ParsedCommand, scanId: string) => InngestEvent[]
> = {
  run_scan: (cmd, scanId) => [
    {
      name: "securewatch/agent2.scan.requested",
      data: { scanId, ...cmd.parameters },
    },
  ],

  get_status: (cmd, scanId) => [
    {
      name: "securewatch/agent2.status.requested",
      data: { scanId, ...cmd.parameters },
    },
  ],

  get_compliance: (cmd, scanId) => [
    {
      name: "securewatch/agent3.status.requested",
      data: { scanId, ...cmd.parameters },
    },
  ],

  get_risks: (cmd, scanId) => [
    {
      name: "securewatch/agent4.risks.requested",
      data: { scanId, ...cmd.parameters },
    },
  ],

  summarize_alerts: (cmd, scanId) => [
    {
      name: "securewatch/agent5.alerts.summarize.requested",
      data: { scanId, ...cmd.parameters },
    },
  ],

  trigger_remediation: (cmd, scanId) => [
    {
      name: "securewatch/agent2.remediation.requested",
      data: { scanId, ...cmd.parameters },
    },
  ],

  get_external_intelligence: (cmd, scanId) => {
    const { domain, companyName, knownEmails, clientId, runAgent1 = true, runAgent2 = true } =
      cmd.parameters as {
        domain: string;
        companyName?: string;
        knownEmails?: string[];
        clientId?: string;
        runAgent1?: boolean;
        runAgent2?: boolean;
      };

    const events: InngestEvent[] = [];
    if (runAgent1) {
      events.push({
        name: "securewatch/agent1.external_discovery.requested",
        data: { scanId, clientId, domain },
      });
    }
    if (runAgent2) {
      events.push({
        name: "securewatch/agent2.osint_collection.requested",
        data: { scanId, clientId, domain, companyName, knownEmails },
      });
    }
    return events;
  },
};

export async function routeCommand(command: ParsedCommand): Promise<RoutedResult> {
  const scanId = randomUUID();
  const buildEvents = INTENT_ROUTES[command.intent];

  if (!buildEvents) {
    throw new Error(`No route defined for intent: ${command.intent}`);
  }

  const events = buildEvents(command, scanId);
  if (events.length === 0) {
    throw new Error(`Route for intent "${command.intent}" produced no events`);
  }

  await inngest.send(events);

  return {
    scanId,
    triggeredEvents: events.map((e) => e.name),
  };
}
