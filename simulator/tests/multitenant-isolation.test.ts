import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadScenarioDefinitionFile } from "../engines/simulationRunner";
import type { EmitCorrelation } from "../engines/eventEmitter";
import { computeAutonomyScorecard } from "../reports/autonomyScorecard";
import { buildSimulationDashboardSummary } from "../reports/dashboardSummary";
import type { SimulationDashboardSummary } from "../reports/dashboardSummary";
import type { SimulationResult, SimulationRun, SimulatedEvent } from "../types";
import { MOCK_AGENT_RESULTS_ALL_PASS } from "./fixtures/mockAgentValidatorResults";
import {
  validateCrossTenantPartition,
  validateDashboardReportScopedToRun,
  validateEmitCorrelationsTenantScoped,
  validateRemediationEventsScopedToTenant,
  validateTenantCoherentSimulationRun,
} from "../multitenant";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseEvent(partial: Partial<SimulatedEvent> & Pick<SimulatedEvent, "id" | "runId">): SimulatedEvent {
  return {
    scenarioId: "scn-test",
    kind: "finding.synthetic",
    simulatedAt: "2026-05-07T10:00:00.000Z",
    payload: {},
    ...partial,
  };
}

describe("multi-tenant isolation (simulator)", () => {
  it("rejects cross-tenant leakage on stamped events", () => {
    const run: SimulationRun = {
      id: "run-1",
      scenarioId: "scn-test",
      startedAt: "2026-05-07T10:00:00.000Z",
      environment: "local",
      tenantId: TENANT_A,
      events: [
        baseEvent({
          id: "e1",
          runId: "run-1",
          tenantId: TENANT_A,
        }),
        baseEvent({
          id: "e2",
          runId: "run-1",
          tenantId: TENANT_B,
        }),
      ],
    };

    const r = validateTenantCoherentSimulationRun(run, TENANT_A);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === "event_tenant_mismatch")).toBe(true);
  });

  it("rejects incorrect remediation payload scope vs tenant envelope", () => {
    const run: SimulationRun = {
      id: "run-rem",
      scenarioId: "scn-test",
      startedAt: "2026-05-07T10:00:00.000Z",
      environment: "local",
      tenantId: TENANT_A,
      events: [
        {
          id: "e-rem",
          scenarioId: "scn-test",
          runId: "run-rem",
          kind: "remediation.execution.synthetic",
          simulatedAt: "2026-05-07T10:00:00.000Z",
          tenantId: TENANT_A,
          payload: {
            summary: "synthetic",
            demo_fixture_tenant_id: TENANT_B,
          },
        },
      ],
    };

    const r = validateRemediationEventsScopedToTenant(run, TENANT_A);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === "remediation_payload_tenant_mismatch")).toBe(true);
  });

  it("rejects dashboard visibility when summary drifts from run id or tenant", () => {
    const run: SimulationRun = {
      id: "run-dash",
      scenarioId: "scn-test",
      startedAt: "2026-05-07T10:00:00.000Z",
      environment: "local",
      tenantId: TENANT_A,
      events: [],
    };

    const badRunId: SimulationDashboardSummary = {
      schema_version: 1,
      generatedAtIso: "2026-05-07T10:01:00.000Z",
      runId: "other-run",
      tenantId: TENANT_A,
      scenarioId: "scn-test",
      scenarioName: "Test",
      status: "passed",
      autonomyScore: 80,
      autonomyReadinessLabel: "ready",
      agentsPassed: 1,
      agentsFailed: 0,
      remediationStatus: "ok",
      controlsValidated: "ok",
      timelineEvents: [],
      executiveSummary: "x",
      technicalSummary: "y",
      nextRecommendedAction: "z",
    };

    const r1 = validateDashboardReportScopedToRun(badRunId, run);
    expect(r1.ok).toBe(false);
    expect(r1.violations[0]?.code).toBe("dashboard_run_mismatch");

    const badTenant: SimulationDashboardSummary = { ...badRunId, runId: "run-dash", tenantId: TENANT_B };
    const r2 = validateDashboardReportScopedToRun(badTenant, run);
    expect(r2.ok).toBe(false);
    expect(r2.violations.some((v) => v.code === "dashboard_tenant_mismatch")).toBe(true);
  });

  it("accepts dashboard summary built from a tenant-scoped run", async () => {
    const scenario = await loadScenarioDefinitionFile(
      path.join(__dirname, "fixtures/mock-minimal-local.json"),
    );

    const run: SimulationRun = {
      id: "run-ok",
      scenarioId: scenario.id,
      startedAt: "2026-05-07T10:00:00.000Z",
      environment: "local",
      tenantId: TENANT_A,
      events: [
        baseEvent({
          id: "e1",
          runId: "run-ok",
          scenarioId: scenario.id,
          tenantId: TENANT_A,
          kind: "monitoring.alert.synthetic",
        }),
      ],
    };

    const result: SimulationResult = {
      runId: run.id,
      scenarioId: scenario.id,
      passed: true,
      validations: [
        { expectationId: "mock-step-1", passed: true, detail: "ok" },
        { expectationId: "aggregation-controls", passed: true, detail: "ok" },
      ],
      summary: "ok",
      finishedAt: "2026-05-07T10:02:00.000Z",
    };

    const signals = {
      observationWindowStartIso: run.startedAt,
      observationWindowEndIso: result.finishedAt,
      pollIterations: 0,
      auditRowsForRun: [],
      auditRowsNearTimeline: [],
    };

    const autonomy = computeAutonomyScorecard({
      scenario,
      result,
      run,
      signals,
      securewatchAgents: MOCK_AGENT_RESULTS_ALL_PASS,
    });

    const summary = buildSimulationDashboardSummary({
      scenario,
      run,
      result,
      autonomyScorecard: autonomy,
      securewatchAgents: MOCK_AGENT_RESULTS_ALL_PASS,
      signals,
      emissions: [{ mode: "local" }],
    });

    const r = validateDashboardReportScopedToRun(summary, run);
    expect(r.ok).toBe(true);
    expect(summary.tenantId).toBe(TENANT_A);
  });

  it("flags shared ingest payloads that reference a foreign tenant", () => {
    const events: SimulatedEvent[] = [
      baseEvent({ id: "e1", runId: "r1", tenantId: TENANT_A, kind: "finding.synthetic" }),
    ];

    const emissions: EmitCorrelation[] = [
      {
        mode: "inngest",
        ingest: {
          data: {
            tenantId: TENANT_B,
            title: "Synthetic",
          },
        },
      },
    ];

    const r = validateEmitCorrelationsTenantScoped(events, emissions, TENANT_A);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === "emission_ingest_tenant_mismatch")).toBe(true);
  });

  it("partition validator passes for two isolated tenant bundles", () => {
    const bundles = [
      {
        tenantId: TENANT_A,
        run: {
          id: "r-a",
          scenarioId: "scn",
          startedAt: "2026-05-07T10:00:00.000Z",
          environment: "local" as const,
          tenantId: TENANT_A,
          events: [baseEvent({ id: "a1", runId: "r-a", tenantId: TENANT_A })],
        },
      },
      {
        tenantId: TENANT_B,
        run: {
          id: "r-b",
          scenarioId: "scn",
          startedAt: "2026-05-07T10:00:00.000Z",
          environment: "local" as const,
          tenantId: TENANT_B,
          events: [baseEvent({ id: "b1", runId: "r-b", tenantId: TENANT_B })],
        },
      },
    ];

    expect(validateCrossTenantPartition(bundles).ok).toBe(true);
  });
});
