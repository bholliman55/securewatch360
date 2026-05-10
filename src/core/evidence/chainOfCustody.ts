import { randomUUID } from "node:crypto";
import type { CustodyEvent } from "./evidence.schema";
import { custodyEventSchema } from "./evidence.schema";

/**
 * Append-only style custody log for forensic defensibility (who touched what, when).
 */
export class ChainOfCustodyLog {
  private readonly events: CustodyEvent[] = [];

  append(event: Omit<CustodyEvent, "custody_id"> & { custody_id?: string }): CustodyEvent {
    const full: CustodyEvent = custodyEventSchema.parse({
      ...event,
      custody_id: event.custody_id ?? randomUUID(),
    });
    this.events.push(full);
    return full;
  }

  timelineForEvidence(evidenceId: string): CustodyEvent[] {
    return this.events.filter((e) => e.evidence_id === evidenceId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }

  timelineForIncident(tenantId: string, incidentId: string, evidenceIds: Set<string>): CustodyEvent[] {
    return this.events
      .filter((e) => e.tenant_id === tenantId && evidenceIds.has(e.evidence_id))
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }

  allEvents(): readonly CustodyEvent[] {
    return this.events;
  }

  clearForTests(): void {
    this.events.splice(0, this.events.length);
  }
}
