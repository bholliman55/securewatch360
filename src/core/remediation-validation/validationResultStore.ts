import type { ValidationRunRecord } from "./remediationValidation.schema";
import { validationRunRecordSchema } from "./remediationValidation.schema";

/**
 * Persists validation runs — replace with Postgres `remediation_validation_runs` in production.
 */
export class ValidationResultStore {
  private readonly byRunId = new Map<string, ValidationRunRecord>();

  save(record: ValidationRunRecord): ValidationRunRecord {
    const parsed = validationRunRecordSchema.parse(record);
    this.byRunId.set(parsed.run_id, parsed);
    return parsed;
  }

  get(runId: string): ValidationRunRecord | undefined {
    return this.byRunId.get(runId);
  }

  listForIncident(tenantId: string, incidentId: string): ValidationRunRecord[] {
    return [...this.byRunId.values()].filter(
      (r) => r.context.tenant_id === tenantId && r.context.incident_id === incidentId,
    );
  }

  clearForTests(): void {
    this.byRunId.clear();
  }
}
