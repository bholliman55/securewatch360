import type { EmitCorrelation } from "../engines/eventEmitter";
import type { SimulatedEvent } from "../types";
import type { TenantIsolationReport, TenantIsolationViolation } from "./types";

function reportFrom(violations: TenantIsolationViolation[]): TenantIsolationReport {
  return { ok: violations.length === 0, violations };
}

const TENANT_KEYS = new Set(["tenantId", "tenant_id", "simulation_tenant_id", "demo_fixture_tenant_id"]);

/**
 * Collect tenant-like string fields from nested ingest / ack objects (Inngest, audit previews, etc.).
 */
export function collectTenantIdStringsFromUnknown(root: unknown, maxDepth = 6, maxNodes = 400): string[] {
  const found: string[] = [];
  const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  let nodes = 0;

  while (stack.length > 0 && nodes < maxNodes) {
    nodes += 1;
    const cur = stack.pop()!;
    if (cur.depth > maxDepth) continue;

    if (!cur.value || typeof cur.value !== "object") continue;

    if (Array.isArray(cur.value)) {
      for (const item of cur.value) {
        stack.push({ value: item, depth: cur.depth + 1 });
      }
      continue;
    }

    const o = cur.value as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (TENANT_KEYS.has(k) && typeof v === "string" && v.trim()) {
        found.push(v.trim());
      }
      if (v !== null && typeof v === "object") {
        stack.push({ value: v, depth: cur.depth + 1 });
      }
    }
  }

  return found;
}

/**
 * Ensures each emission's ingest payload (when present) only references the expected tenant,
 * and parallel SimulatedEvent envelopes match that tenant.
 */
export function validateEmitCorrelationsTenantScoped(
  events: SimulatedEvent[],
  emissions: EmitCorrelation[],
  expectedTenantId: string,
): TenantIsolationReport {
  const violations: TenantIsolationViolation[] = [];

  for (let i = 0; i < events.length; i += 1) {
    const evt = events[i];
    if (evt.tenantId !== undefined && evt.tenantId !== expectedTenantId) {
      violations.push({
        code: "emission_event_tenant_mismatch",
        message: "SimulatedEvent tenant does not match expected scope for shared emission validation.",
        detail: { index: i, eventId: evt.id, expectedTenantId, observed: evt.tenantId },
      });
    }
  }

  const n = Math.min(events.length, emissions.length);
  for (let i = 0; i < n; i += 1) {
    const ingest = emissions[i]?.ingest;
    if (ingest === undefined) continue;

    const tenantStrings = collectTenantIdStringsFromUnknown(ingest);
    for (const t of tenantStrings) {
      if (t !== expectedTenantId) {
        violations.push({
          code: "emission_ingest_tenant_mismatch",
          message: "Orchestration ingest payload references an unexpected tenant id.",
          detail: { index: i, eventId: events[i]?.id, expectedTenantId, observed: t },
        });
      }
    }
  }

  return reportFrom(violations);
}
