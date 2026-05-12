import type { SimulationDashboardSummary } from "../reports/dashboardSummary";
import type { SimulatedEvent, SimulationRun } from "../types";
import type {
  TenantIsolationReport,
  TenantIsolationViolation,
  TenantScopedSimulationBundle,
} from "./types";

function reportFrom(violations: TenantIsolationViolation[]): TenantIsolationReport {
  return { ok: violations.length === 0, violations };
}

/** Every stamped event and the run record must carry the same tenant id. */
export function validateTenantCoherentSimulationRun(
  run: SimulationRun,
  expectedTenantId: string,
): TenantIsolationReport {
  const violations: TenantIsolationViolation[] = [];

  if (!run.tenantId) {
    violations.push({
      code: "run_missing_tenant",
      message: "SimulationRun.tenantId is required for tenant-isolated validation.",
      detail: { runId: run.id },
    });
  } else if (run.tenantId !== expectedTenantId) {
    violations.push({
      code: "run_tenant_mismatch",
      message: "SimulationRun.tenantId does not match the expected tenant scope.",
      detail: { runId: run.id, expectedTenantId, observed: run.tenantId },
    });
  }

  for (const evt of run.events) {
    if (!evt.tenantId) {
      violations.push({
        code: "event_missing_tenant",
        message: "SimulatedEvent.tenantId is required on every event for isolation checks.",
        detail: { runId: run.id, eventId: evt.id, kind: evt.kind },
      });
      continue;
    }
    if (evt.tenantId !== expectedTenantId) {
      violations.push({
        code: "event_tenant_mismatch",
        message: "SimulatedEvent.tenantId does not match the expected tenant scope.",
        detail: { runId: run.id, eventId: evt.id, expectedTenantId, observed: evt.tenantId },
      });
    }
  }

  return reportFrom(violations);
}

/**
 * Validates several tenant-scoped runs at once: each bundle's events must not carry another
 * bundle's tenant id (cross-tenant leakage).
 */
export function validateCrossTenantPartition(bundles: TenantScopedSimulationBundle[]): TenantIsolationReport {
  const violations: TenantIsolationViolation[] = [];

  for (const { tenantId, run } of bundles) {
    if (run.tenantId !== undefined && run.tenantId !== tenantId) {
      violations.push({
        code: "cross_tenant_run_tenant_mismatch",
        message: "Bundle tenantId does not match SimulationRun.tenantId.",
        detail: { bundleTenantId: tenantId, runTenantId: run.tenantId, runId: run.id },
      });
    }
    for (const evt of run.events) {
      if (!evt.tenantId) {
        violations.push({
          code: "event_missing_tenant",
          message: "Event missing tenantId under multi-tenant partition check.",
          detail: { runId: run.id, eventId: evt.id },
        });
        continue;
      }
      if (evt.tenantId !== tenantId) {
        violations.push({
          code: "cross_tenant_event_leak",
          message: "Event tenantId does not belong to this bundle (possible cross-tenant leakage).",
          detail: { runId: run.id, eventId: evt.id, bundleTenantId: tenantId, observed: evt.tenantId },
        });
      }
    }
  }

  return reportFrom(violations);
}

function readPayloadTenantHints(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };

  push(payload.tenant_id);
  push(payload.tenantId);
  push(payload.demo_fixture_tenant_id);

  const exec = payload.execution;
  if (exec && typeof exec === "object" && exec !== null) {
    const e = exec as Record<string, unknown>;
    push(e.tenant_id);
    push(e.tenantId);
  }

  return out;
}

/** Remediation-style events must not reference a different tenant in payload than on the envelope. */
export function validateRemediationEventsScopedToTenant(
  run: SimulationRun,
  tenantId: string,
): TenantIsolationReport {
  const violations: TenantIsolationViolation[] = [];

  for (const evt of run.events) {
    if (evt.kind !== "remediation.execution.synthetic") continue;

    if (evt.tenantId !== undefined && evt.tenantId !== tenantId) {
      violations.push({
        code: "remediation_event_tenant_mismatch",
        message: "Remediation synthetic event envelope tenant does not match scope.",
        detail: { eventId: evt.id, expectedTenantId: tenantId, observed: evt.tenantId },
      });
    }

    const hints = readPayloadTenantHints(evt.payload ?? {});
    for (const h of hints) {
      if (h !== tenantId) {
        violations.push({
          code: "remediation_payload_tenant_mismatch",
          message: "Remediation payload tenant hint disagrees with scoped tenant.",
          detail: { eventId: evt.id, expectedTenantId: tenantId, observed: h },
        });
      }
    }
  }

  return reportFrom(violations);
}

/** Dashboard summary must only describe the same run/tenant as the authoritative SimulationRun. */
export function validateDashboardReportScopedToRun(
  summary: SimulationDashboardSummary,
  run: SimulationRun,
): TenantIsolationReport {
  const violations: TenantIsolationViolation[] = [];

  if (summary.runId !== run.id) {
    violations.push({
      code: "dashboard_run_mismatch",
      message: "Dashboard summary runId does not match SimulationRun.id (visibility / cache bug risk).",
      detail: { summaryRunId: summary.runId, runId: run.id },
    });
  }

  if (run.tenantId !== undefined) {
    if (summary.tenantId === undefined) {
      violations.push({
        code: "dashboard_tenant_mismatch",
        message: "Dashboard summary missing tenantId while run is tenant-scoped.",
        detail: { runId: run.id },
      });
    } else if (summary.tenantId !== run.tenantId) {
      violations.push({
        code: "dashboard_tenant_mismatch",
        message: "Dashboard summary tenantId does not match SimulationRun.tenantId.",
        detail: { summaryTenantId: summary.tenantId, runTenantId: run.tenantId },
      });
    }
  }

  return reportFrom(violations);
}
