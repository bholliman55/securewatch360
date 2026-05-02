/**
 * Shared telemetry shapes collected after simulation emits — kept separate from heavyweight collectors
 * so validators can rely on structural typing without importing Supabase-backed modules.
 */

export type SimulationAuditRow = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type CollectedSignals = {
  observationWindowStartIso: string;
  observationWindowEndIso: string;
  pollIterations: number;
  auditRowsForRun: SimulationAuditRow[];
  auditRowsNearTimeline: SimulationAuditRow[];
};
