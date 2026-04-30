import { inngest } from "@/inngest/client";
import { runOsintCollection } from "@/agents/agent2-osint/osintCollectionService";
import { upsertIntelligenceEvents } from "@/repositories/externalIntelligenceRepository";
import { randomUUID } from "crypto";

export const runOsintCollectionFunction = inngest.createFunction(
  { id: "run-osint-collection", name: "Agent 2: OSINT & Threat Intelligence Collection" },
  { event: "securewatch/agent2.osint_collection.requested" },
  async ({ event, step }) => {
    const { domain, companyName, knownEmails, clientId, scanId } = event.data as {
      scanId?: string;
      clientId?: string;
      domain: string;
      companyName?: string;
      knownEmails?: string[];
    };

    if (!domain || typeof domain !== "string") {
      throw new Error("Invalid payload: domain is required");
    }

    const resolvedScanId = scanId ?? randomUUID();

    const result = await step.run("collect-osint", async () => {
      return runOsintCollection({ domain, companyName, knownEmails, clientId, scanId: resolvedScanId });
    });

    await step.run("persist-events", async () => {
      const hydratedEvents = result.events.map((e) => ({
      ...e,
      firstSeen: e.firstSeen ? new Date(e.firstSeen) : undefined,
      lastSeen: e.lastSeen ? new Date(e.lastSeen) : undefined,
    }));
    await upsertIntelligenceEvents(hydratedEvents);
    });

    await step.sendEvent("emit-discovered", {
      name: "securewatch/osint_events.discovered",
      data: {
        scanId: resolvedScanId,
        clientId,
        domain,
        totalEvents: result.totalEvents,
        severityBreakdown: result.severityBreakdown,
        errors: result.errors,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId: resolvedScanId,
      domain,
      totalEvents: result.totalEvents,
      severityBreakdown: result.severityBreakdown,
      errors: result.errors,
    };
  }
);
