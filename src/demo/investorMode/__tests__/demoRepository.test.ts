import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DEMO_SCENARIO_ID } from "../demoConfig";
import { ACME_DENTAL, ACME_FS01, LAPTOP_123 } from "../demoSeedData";
import {
  createDemoRepository,
  upsertDemoMetricsBulk,
  type DemoEventRow,
  type DemoMetricRow,
  type DemoActionRow,
  type DemoReportRow,
} from "../demoRepository";

// ---------------------------------------------------------------------------
// Hand-rolled Supabase builder mock.
//
// Mirrors the approach used in `src/server/voice/__tests__/voiceRepository.test.ts`.
// The mock records every operation and lets the test choose what to return for
// each (op, table) pair so we can verify both happy path and failure handling
// without standing up a real Postgres.
// ---------------------------------------------------------------------------

type Op = "select" | "insert" | "update" | "delete" | "upsert";

interface Recorded {
  op: Op;
  table: string;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  filters: Array<{ column: string; value: unknown }>;
  orderBy?: { column: string; ascending: boolean };
  upsertOnConflict?: string;
}

type MockResult =
  | { data: unknown; error: null }
  | { data: null; error: { message: string } };

type Responder = (op: Op, table: string) => MockResult;

/**
 * Every node in the chain is BOTH thenable (so `await chain.eq(...)` resolves
 * to the responder result) AND chainable (so `chain.eq(...).order(...)`
 * still works). This mirrors how real supabase-js builders behave.
 */
interface ChainNode extends PromiseLike<MockResult> {
  eq(column: string, value: unknown): ChainNode;
  order(column: string, opts?: { ascending?: boolean }): ChainNode;
  select(query?: string): ChainNode;
  single(): Promise<MockResult>;
  maybeSingle(): Promise<MockResult>;
}

function makeChainNode(rec: Recorded, responder: Responder): ChainNode {
  const resolve = (): Promise<MockResult> =>
    Promise.resolve(responder(rec.op, rec.table));

  const node: ChainNode = {
    then(onFulfilled, onRejected) {
      return resolve().then(onFulfilled, onRejected);
    },
    eq(column, value) {
      rec.filters.push({ column, value });
      return makeChainNode(rec, responder);
    },
    order(column, opts) {
      rec.orderBy = { column, ascending: opts?.ascending !== false };
      return makeChainNode(rec, responder);
    },
    select() {
      return makeChainNode(rec, responder);
    },
    single() {
      return resolve();
    },
    maybeSingle() {
      return resolve();
    },
  };
  return node;
}

function makeSupabaseMock(responder: Responder) {
  const calls: Recorded[] = [];

  const startCall = (op: Op, table: string, values?: Recorded["values"]): ChainNode => {
    const rec: Recorded = { op, table, filters: [] };
    if (values !== undefined) rec.values = values;
    calls.push(rec);
    return makeChainNode(rec, responder);
  };

  const fromMock = vi.fn((table: string) => ({
    select(_q?: string) {
      return startCall("select", table);
    },
    insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
      return startCall("insert", table, values);
    },
    update(values: Record<string, unknown>) {
      return startCall("update", table, values);
    },
    delete() {
      return startCall("delete", table);
    },
    upsert(
      values: Record<string, unknown> | Array<Record<string, unknown>>,
      opts?: { onConflict?: string },
    ) {
      const chain = startCall("upsert", table, values);
      const last = calls[calls.length - 1]!;
      last.upsertOnConflict = opts?.onConflict;
      return chain;
    },
  }));

  const client = { from: fromMock } as unknown as SupabaseClient;
  return { client, calls, fromMock };
}

// ---------------------------------------------------------------------------
// Default success responder helpers
// ---------------------------------------------------------------------------

function ok(data: unknown): MockResult {
  return { data, error: null };
}

function fail(message: string): MockResult {
  return { data: null, error: { message } };
}

// ---------------------------------------------------------------------------
// seedDemoScenario
// ---------------------------------------------------------------------------

describe("createDemoRepository.seedDemoScenario", () => {
  it("upserts the scenario row, inserts the client, and inserts both assets", async () => {
    const scenarioRow = {
      id: "scenario-id",
      scenario_key: DEMO_SCENARIO_ID,
      name: "headline",
      description: "desc",
      status: "ready",
      created_at: "2026-05-08T00:00:00Z",
      updated_at: "2026-05-08T00:00:00Z",
    };
    const clientRow = {
      id: "client-id",
      scenario_key: DEMO_SCENARIO_ID,
      client_name: ACME_DENTAL.name,
      industry: ACME_DENTAL.industry,
      employee_count: ACME_DENTAL.employeeCount,
      msp_name: ACME_DENTAL.msp,
      compliance_frameworks: [...ACME_DENTAL.complianceFrameworks],
      metadata: {},
      created_at: "2026-05-08T00:00:00Z",
    };

    let assetCount = 0;
    const { client, calls } = makeSupabaseMock((op, table) => {
      if (table === "demo_scenarios" && op === "upsert") return ok(scenarioRow);
      if (table === "demo_clients" && op === "insert") return ok(clientRow);
      if (table === "demo_assets" && op === "insert") {
        assetCount += 1;
        return ok({
          id: `asset-${assetCount}`,
          scenario_key: DEMO_SCENARIO_ID,
          client_name: ACME_DENTAL.name,
          asset_name: assetCount === 1 ? ACME_FS01.hostname : LAPTOP_123.hostname,
          asset_type: assetCount === 1 ? "file_server" : "endpoint",
          risk_level: assetCount === 1 ? "critical" : "high",
          status: "healthy",
          metadata: {},
          created_at: "2026-05-08T00:00:00Z",
        });
      }
      throw new Error(`unexpected ${op} on ${table}`);
    });

    const repo = createDemoRepository(client);
    const result = await repo.seedDemoScenario();

    expect(result.scenario?.scenario_key).toBe(DEMO_SCENARIO_ID);
    expect(result.client?.client_name).toBe(ACME_DENTAL.name);
    expect(result.assets).toHaveLength(2);
    expect(result.assets.map((a) => a.asset_name)).toEqual([
      ACME_FS01.hostname,
      LAPTOP_123.hostname,
    ]);

    const tablesCalled = calls.map((c) => `${c.op}:${c.table}`);
    expect(tablesCalled).toEqual([
      "upsert:demo_scenarios",
      "insert:demo_clients",
      "insert:demo_assets",
      "insert:demo_assets",
    ]);

    const upsert = calls[0]!;
    expect(upsert.upsertOnConflict).toBe("scenario_key");
  });

  it("returns nulls for failed inserts but does not throw", async () => {
    const { client } = makeSupabaseMock(() => fail("simulated db down"));
    const repo = createDemoRepository(client);
    const result = await repo.seedDemoScenario();
    expect(result.scenario).toBeNull();
    expect(result.client).toBeNull();
    expect(result.assets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resetDemoScenario
// ---------------------------------------------------------------------------

describe("createDemoRepository.resetDemoScenario", () => {
  it("deletes from every per-run table for the requested scenario", async () => {
    const { client, calls } = makeSupabaseMock(() => ok(null));
    const repo = createDemoRepository(client);
    const result = await repo.resetDemoScenario();

    expect(result.ok).toBe(true);
    expect(result.scenarioKey).toBe(DEMO_SCENARIO_ID);
    expect(Object.values(result.cleared).every((v) => v === "ok")).toBe(true);

    const tables = calls.filter((c) => c.op === "delete").map((c) => c.table);
    expect(tables).toEqual([
      "demo_events",
      "demo_agent_reasoning",
      "demo_actions",
      "demo_reports",
      "demo_metrics",
    ]);
    for (const c of calls) {
      expect(c.filters).toEqual([{ column: "scenario_key", value: DEMO_SCENARIO_ID }]);
    }
  });

  it("flags the per-table failure and surfaces the first error message", async () => {
    const { client } = makeSupabaseMock((op, table) => {
      if (op === "delete" && table === "demo_actions") {
        return fail("actions wipe failed");
      }
      return ok(null);
    });
    const repo = createDemoRepository(client);
    const result = await repo.resetDemoScenario();
    expect(result.ok).toBe(false);
    expect(result.cleared.demo_actions).toBe("failed");
    expect(result.cleared.demo_events).toBe("ok");
    expect(result.error).toBe("actions wipe failed");
  });

  it("uses the supplied scenarioKey instead of the default", async () => {
    const { client, calls } = makeSupabaseMock(() => ok(null));
    const repo = createDemoRepository(client);
    await repo.resetDemoScenario("custom-scenario");
    for (const c of calls) {
      expect(c.filters).toEqual([{ column: "scenario_key", value: "custom-scenario" }]);
    }
  });
});

// ---------------------------------------------------------------------------
// getDemoTimeline
// ---------------------------------------------------------------------------

describe("createDemoRepository.getDemoTimeline", () => {
  it("returns events ordered by event_order ascending", async () => {
    const rows: DemoEventRow[] = [
      {
        id: "e1",
        scenario_key: DEMO_SCENARIO_ID,
        event_order: 1,
        offset_seconds: 0,
        event_type: "demo_started",
        severity: "info",
        title: "started",
        description: "",
        agent_name: null,
        status: "emitted",
        payload: {},
        emitted_at: "2026-05-08T00:00:00Z",
        created_at: "2026-05-08T00:00:00Z",
      },
    ];

    const { client, calls } = makeSupabaseMock(() => ok(rows));
    const repo = createDemoRepository(client);
    const result = await repo.getDemoTimeline();
    expect(result).toEqual(rows);

    const call = calls[0]!;
    expect(call.op).toBe("select");
    expect(call.table).toBe("demo_events");
    expect(call.orderBy).toEqual({ column: "event_order", ascending: true });
    expect(call.filters).toEqual([
      { column: "scenario_key", value: DEMO_SCENARIO_ID },
    ]);
  });

  it("returns [] when the query errors", async () => {
    const { client } = makeSupabaseMock(() => fail("read failed"));
    const repo = createDemoRepository(client);
    expect(await repo.getDemoTimeline()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// emitDemoEvent
// ---------------------------------------------------------------------------

describe("createDemoRepository.emitDemoEvent", () => {
  it("inserts with status=emitted and a fresh emitted_at timestamp", async () => {
    const inserted: DemoEventRow = {
      id: "e2",
      scenario_key: DEMO_SCENARIO_ID,
      event_order: 5,
      offset_seconds: 12,
      event_type: "agent_classification",
      severity: "critical",
      title: "Agent 5 classified",
      description: "ransomware precursor",
      agent_name: "agent5-classification",
      status: "emitted",
      payload: { confidence: 0.94 },
      emitted_at: "2026-05-08T00:00:01Z",
      created_at: "2026-05-08T00:00:01Z",
    };
    const { client, calls } = makeSupabaseMock(() => ok(inserted));
    const repo = createDemoRepository(client);
    const result = await repo.emitDemoEvent({
      eventOrder: 5,
      offsetSeconds: 12,
      eventType: "agent_classification",
      severity: "critical",
      title: "Agent 5 classified",
      description: "ransomware precursor",
      agentName: "agent5-classification",
      payload: { confidence: 0.94 },
    });

    expect(result).toEqual(inserted);
    const call = calls[0]!;
    expect(call.op).toBe("insert");
    expect(call.table).toBe("demo_events");
    const values = call.values as Record<string, unknown>;
    expect(values.status).toBe("emitted");
    expect(typeof values.emitted_at).toBe("string");
    expect(values.scenario_key).toBe(DEMO_SCENARIO_ID);
    expect(values.event_order).toBe(5);
    expect(values.payload).toEqual({ confidence: 0.94 });
  });

  it("returns null when the insert fails", async () => {
    const { client } = makeSupabaseMock(() => fail("insert failed"));
    const repo = createDemoRepository(client);
    const result = await repo.emitDemoEvent({
      eventOrder: 1,
      offsetSeconds: 0,
      eventType: "demo_started",
      severity: "info",
      title: "x",
      description: "y",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateDemoAction
// ---------------------------------------------------------------------------

describe("createDemoRepository.updateDemoAction", () => {
  it("only updates the columns provided in input", async () => {
    const updated: DemoActionRow = {
      id: "a1",
      scenario_key: DEMO_SCENARIO_ID,
      action_type: "isolate_endpoint",
      action_label: "Isolate LAPTOP-123",
      safety_level: "DESTRUCTIVE_ACTION",
      requires_confirmation: true,
      confirmed: true,
      status: "executed",
      result_summary: "isolated",
      created_at: "2026-05-08T00:00:00Z",
      executed_at: "2026-05-08T00:00:33Z",
    };
    const { client, calls } = makeSupabaseMock(() => ok(updated));
    const repo = createDemoRepository(client);
    const result = await repo.updateDemoAction("a1", {
      status: "executed",
      confirmed: true,
      resultSummary: "isolated",
      executedAt: "2026-05-08T00:00:33Z",
    });
    expect(result).toEqual(updated);

    const call = calls[0]!;
    expect(call.op).toBe("update");
    expect(call.table).toBe("demo_actions");
    expect(call.filters).toEqual([{ column: "id", value: "a1" }]);
    const values = call.values as Record<string, unknown>;
    expect(values).toEqual({
      status: "executed",
      confirmed: true,
      result_summary: "isolated",
      executed_at: "2026-05-08T00:00:33Z",
    });
  });

  it("returns null when no fields are supplied (no DB call)", async () => {
    const { client, calls } = makeSupabaseMock(() => ok(null));
    const repo = createDemoRepository(client);
    const result = await repo.updateDemoAction("a1", {});
    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDemoMetrics
// ---------------------------------------------------------------------------

describe("createDemoRepository.getDemoMetrics", () => {
  it("returns rows ordered by sort_order ascending", async () => {
    const rows: DemoMetricRow[] = [
      {
        id: "m1",
        scenario_key: DEMO_SCENARIO_ID,
        metric_key: "ttd",
        metric_label: "Time to detect",
        metric_value: "3s",
        sort_order: 1,
        created_at: "2026-05-08T00:00:00Z",
      },
    ];
    const { client, calls } = makeSupabaseMock(() => ok(rows));
    const repo = createDemoRepository(client);
    const result = await repo.getDemoMetrics();
    expect(result).toEqual(rows);

    const call = calls[0]!;
    expect(call.op).toBe("select");
    expect(call.table).toBe("demo_metrics");
    expect(call.orderBy).toEqual({ column: "sort_order", ascending: true });
  });
});

// ---------------------------------------------------------------------------
// createDemoReport
// ---------------------------------------------------------------------------

describe("createDemoRepository.createDemoReport", () => {
  it("inserts an executive report row with the scenario key", async () => {
    const inserted: DemoReportRow = {
      id: "r1",
      scenario_key: DEMO_SCENARIO_ID,
      report_type: "executive",
      title: "Acme Dental: contained",
      summary: "summary",
      report_json: { foo: "bar" },
      created_at: "2026-05-08T00:00:00Z",
    };
    const { client, calls } = makeSupabaseMock(() => ok(inserted));
    const repo = createDemoRepository(client);
    const result = await repo.createDemoReport({
      reportType: "executive",
      title: "Acme Dental: contained",
      summary: "summary",
      reportJson: { foo: "bar" },
    });
    expect(result).toEqual(inserted);

    const call = calls[0]!;
    expect(call.op).toBe("insert");
    expect(call.table).toBe("demo_reports");
    const values = call.values as Record<string, unknown>;
    expect(values).toEqual({
      scenario_key: DEMO_SCENARIO_ID,
      report_type: "executive",
      title: "Acme Dental: contained",
      summary: "summary",
      report_json: { foo: "bar" },
    });
  });

  it("returns null when the insert fails", async () => {
    const { client } = makeSupabaseMock(() => fail("nope"));
    const repo = createDemoRepository(client);
    const result = await repo.createDemoReport({
      reportType: "business_impact",
      title: "x",
      summary: "y",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// upsertDemoMetricsBulk (helper used by the metrics service)
// ---------------------------------------------------------------------------

describe("upsertDemoMetricsBulk", () => {
  it("returns [] when given no metrics (no DB call)", async () => {
    const { client, calls } = makeSupabaseMock(() => ok(null));
    const result = await upsertDemoMetricsBulk([], DEMO_SCENARIO_ID, client);
    expect(result).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("upserts rows with the composite-key conflict target", async () => {
    const rows: DemoMetricRow[] = [
      {
        id: "m1",
        scenario_key: DEMO_SCENARIO_ID,
        metric_key: "ttd",
        metric_label: "Time to detect",
        metric_value: "3s",
        sort_order: 1,
        created_at: "2026-05-08T00:00:00Z",
      },
    ];
    const { client, calls } = makeSupabaseMock(() => ok(rows));
    const result = await upsertDemoMetricsBulk(
      [{ metricKey: "ttd", metricLabel: "Time to detect", metricValue: "3s", sortOrder: 1 }],
      DEMO_SCENARIO_ID,
      client,
    );
    expect(result).toEqual(rows);
    const call = calls[0]!;
    expect(call.op).toBe("upsert");
    expect(call.upsertOnConflict).toBe("scenario_key,metric_key");
  });
});
