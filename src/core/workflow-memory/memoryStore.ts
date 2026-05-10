import type { WorkflowMemoryEntry } from "./workflowMemory.schema";
import { workflowMemoryEntrySchema } from "./workflowMemory.schema";

/**
 * Tenant-isolated memory index — swap for Postgres with RLS in production.
 */
export class WorkflowMemoryStore {
  private readonly entries: WorkflowMemoryEntry[] = [];

  append(entry: WorkflowMemoryEntry): WorkflowMemoryEntry {
    const parsed = workflowMemoryEntrySchema.parse(entry);
    this.entries.push(parsed);
    return parsed;
  }

  listTenant(tenantId: string, filter?: { track_type?: WorkflowMemoryEntry["track_type"] }): WorkflowMemoryEntry[] {
    return this.entries
      .filter((e) => e.tenant_id === tenantId)
      .filter((e) => !filter?.track_type || e.track_type === filter.track_type)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  }

  aggregateCountBySubject(tenantId: string, trackType: WorkflowMemoryEntry["track_type"], subjectKey: string): number {
    return this.entries
      .filter((e) => e.tenant_id === tenantId && e.track_type === trackType && e.subject_key === subjectKey)
      .reduce((s, e) => s + e.count_weight, 0);
  }

  clearForTests(): void {
    this.entries.length = 0;
  }
}
