/**
 * Multi-tenant isolation contracts for the SecureWatch360 simulation lab.
 * Validators are pure — safe to run in CI without live orchestration sinks.
 */

import type { SimulationRun } from "../types";

export type TenantIsolationViolationCode =
  | "run_missing_tenant"
  | "run_tenant_mismatch"
  | "event_missing_tenant"
  | "event_tenant_mismatch"
  | "cross_tenant_event_leak"
  | "cross_tenant_run_tenant_mismatch"
  | "remediation_payload_tenant_mismatch"
  | "remediation_event_tenant_mismatch"
  | "dashboard_run_mismatch"
  | "dashboard_tenant_mismatch"
  | "emission_ingest_tenant_mismatch"
  | "emission_event_tenant_mismatch";

export interface TenantIsolationViolation {
  code: TenantIsolationViolationCode;
  message: string;
  detail?: Record<string, unknown>;
}

export interface TenantIsolationReport {
  ok: boolean;
  violations: TenantIsolationViolation[];
}

export interface TenantScopedSimulationBundle {
  tenantId: string;
  run: SimulationRun;
}
