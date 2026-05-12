import { randomUUID } from "node:crypto";
import type { ChainOfCustodyLog } from "./chainOfCustody";
import type { EvidenceItem } from "./evidence.schema";
import { evidenceItemSchema } from "./evidence.schema";

/**
 * Tenant-scoped evidence index — swap backing store for Postgres / object storage in production.
 */
export class EvidenceStore {
  private readonly byId = new Map<string, EvidenceItem>();

  constructor(private readonly custody?: ChainOfCustodyLog) {}

  /**
   * Validates and indexes evidence; records a `created` custody event when a log is configured.
   */
  add(item: EvidenceItem, custodyActor = "system:evidence_store"): EvidenceItem {
    const parsed = evidenceItemSchema.parse(item);
    this.byId.set(parsed.evidence_id, parsed);
    this.custody?.append({
      evidence_id: parsed.evidence_id,
      tenant_id: parsed.tenant_id,
      recorded_at: new Date().toISOString(),
      actor: custodyActor,
      action: "created",
      notes: `Indexed ${parsed.evidence_type}`,
    });
    return parsed;
  }

  createId(): string {
    return randomUUID();
  }

  get(evidenceId: string): EvidenceItem | undefined {
    return this.byId.get(evidenceId);
  }

  listByIncident(tenantId: string, incidentId: string): EvidenceItem[] {
    return [...this.byId.values()]
      .filter((e) => e.tenant_id === tenantId && e.incident_id === incidentId)
      .sort((a, b) => a.collected_at.localeCompare(b.collected_at));
  }

  listByTenant(tenantId: string): EvidenceItem[] {
    return [...this.byId.values()]
      .filter((e) => e.tenant_id === tenantId)
      .sort((a, b) => a.collected_at.localeCompare(b.collected_at));
  }

  clearForTests(): void {
    this.byId.clear();
  }
}
