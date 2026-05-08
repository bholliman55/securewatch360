import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  INVESTOR_DEMO_SCENARIO,
  INVESTOR_DEMO_SEED_REPORT_PREFIX,
} from "../demoSeedData";
import {
  resetInvestorDemoScenario,
  runInvestorDemoScenario,
  seedInvestorDemoScenario,
  type RunInvestorDemoClock,
  type RunInvestorDemoLogger,
} from "../demoRepository";

// ---------------------------------------------------------------------------
// In-memory Supabase facade
//
// Implements just enough of the supabase-js builder surface to drive
// seed → run → reset end-to-end. Each operation either resolves directly
// (delete/update/upsert without `.select()`) or chains into `.select()`
// which returns a thenable yielding the affected rows. Errors can be
// injected per (op, table) pair so we can verify error propagation.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update" | "delete" | "upsert";

interface Filter {
  kind: "eq" | "like" | "not_like";
  column: string;
  value: unknown;
}

function rowMatches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (f.kind === "eq") return row[f.column] === f.value;
    if (f.kind === "like") {
      return typeof row[f.column] === "string"
        ? matchSqlLike(row[f.column] as string, String(f.value))
        : false;
    }
    // not_like
    return typeof row[f.column] === "string"
      ? !matchSqlLike(row[f.column] as string, String(f.value))
      : true;
  });
}

function matchSqlLike(value: string, pattern: string): boolean {
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".") +
      "$",
  );
  return re.test(value);
}

interface MemoryStore {
  rows: Map<string, Row[]>;
  /** Map of `${op}:${table}` → forced error message. */
  errors: Map<string, string>;
}

function makeMemorySupabase(): {
  client: SupabaseClient;
  store: MemoryStore;
} {
  const store: MemoryStore = { rows: new Map(), errors: new Map() };

  const tableRows = (table: string): Row[] => {
    let bucket = store.rows.get(table);
    if (!bucket) {
      bucket = [];
      store.rows.set(table, bucket);
    }
    return bucket;
  };

  const errorOk = (op: Op, table: string): { error: { message: string } } | null => {
    const msg = store.errors.get(`${op}:${table}`);
    return msg ? { error: { message: msg } } : null;
  };

  let counter = 0;
  const newId = (): string => `mem-${++counter}`;

  type Result = { data: unknown; error: unknown };

  const startCall = (op: Op, table: string, values?: Row | Row[]) => {
    const filters: Filter[] = [];
    let resolved: Result | null = null;

    const resolve = async (
      mode: "withSelect" | "noSelect",
    ): Promise<Result> => {
      if (resolved) return resolved;
      const errorRes = errorOk(op, table);
      if (errorRes) {
        resolved = { data: null, error: errorRes.error };
        return resolved;
      }

      const rows = tableRows(table);
      let affected: Row[] = [];

      if (op === "select") {
        affected = rows.filter((r) => rowMatches(r, filters));
      } else if (op === "insert") {
        const list = Array.isArray(values) ? values : [values!];
        const inserted = list.map((v) => ({ id: newId(), ...v }));
        rows.push(...inserted);
        affected = inserted;
      } else if (op === "upsert") {
        const list = Array.isArray(values) ? values : [values!];
        const sample = list[0] as (Row & { __onConflict?: string }) | undefined;
        const conflictKeys = (sample?.__onConflict ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const keys = conflictKeys.length ? conflictKeys : ["id"];
        for (const v of list) {
          // Strip the sidecar marker before persisting so the assertion view stays clean.
          const { __onConflict: _drop, ...clean } = v as Row & {
            __onConflict?: string;
          };
          void _drop;
          const idx = rows.findIndex((r) =>
            keys.every((k) => r[k] === clean[k]),
          );
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...clean };
            affected.push(rows[idx]!);
          } else {
            const inserted = { id: newId(), ...clean };
            rows.push(inserted);
            affected.push(inserted);
          }
        }
      } else if (op === "update") {
        for (const r of rows) {
          if (rowMatches(r, filters)) {
            Object.assign(r, values as Row);
            affected.push(r);
          }
        }
      } else if (op === "delete") {
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rowMatches(rows[i]!, filters)) {
            affected.unshift(rows[i]!);
            rows.splice(i, 1);
          }
        }
      }

      resolved = {
        data: mode === "withSelect" ? affected : affected[0] ?? null,
        error: null,
      };
      return resolved;
    };

    interface BuilderNode extends PromiseLike<Result> {
      eq(column: string, value: unknown): BuilderNode;
      like(column: string, value: unknown): BuilderNode;
      not(column: string, operator: string, value: unknown): BuilderNode;
      order(column: string, opts?: { ascending?: boolean }): PromiseLike<Result>;
      select(): BuilderNode;
      single(): Promise<Result>;
      maybeSingle(): Promise<Result>;
    }

    const buildNode = (mode: "withSelect" | "noSelect"): BuilderNode => {
      const self: BuilderNode = {
        then<TResult1 = Result, TResult2 = never>(
          onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | undefined | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
        ): PromiseLike<TResult1 | TResult2> {
          return resolve(mode).then(onfulfilled, onrejected);
        },
        eq(column: string, value: unknown) {
          filters.push({ kind: "eq", column, value });
          return buildNode(mode);
        },
        like(column: string, value: unknown) {
          filters.push({ kind: "like", column, value });
          return buildNode(mode);
        },
        not(column: string, operator: string, value: unknown) {
          if (operator === "like") {
            filters.push({ kind: "not_like", column, value });
          }
          return buildNode(mode);
        },
        order(_column: string, _opts?: { ascending?: boolean }) {
          // Order is implementation detail; tests assert via final list comparison.
          return {
            then<TResult1 = Result, TResult2 = never>(
              onfulfilled?:
                | ((value: Result) => TResult1 | PromiseLike<TResult1>)
                | undefined
                | null,
              onrejected?:
                | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
                | undefined
                | null,
            ): PromiseLike<TResult1 | TResult2> {
              return resolve("withSelect").then(onfulfilled, onrejected);
            },
          };
        },
        select() {
          return buildNode("withSelect");
        },
        async single() {
          const r = await resolve("noSelect");
          if (r.error) return r;
          return { data: (r.data as Row[] | null) ?? r.data, error: null };
        },
        async maybeSingle() {
          return resolve("noSelect");
        },
      };
      return self;
    };

    return buildNode("noSelect");
  };

  const client: SupabaseClient = {
    from(table: string) {
      return {
        select(_q?: string) {
          return startCall("select", table);
        },
        insert(values: Row | Row[]) {
          return startCall("insert", table, values);
        },
        update(values: Row) {
          return startCall("update", table, values);
        },
        delete() {
          return startCall("delete", table);
        },
        upsert(values: Row | Row[], opts?: { onConflict?: string }) {
          // Stash onConflict on the values so the mock can find it (read inside
          // resolve). Uses a non-conflicting key.
          if (opts?.onConflict) {
            if (Array.isArray(values)) {
              for (const v of values) {
                (v as Row & { __onConflict?: string }).__onConflict = opts.onConflict;
              }
            } else {
              (values as Row & { __onConflict?: string }).__onConflict = opts.onConflict;
            }
          }
          return startCall("upsert", table, values);
        },
      } as unknown as ReturnType<SupabaseClient["from"]>;
    },
  } as unknown as SupabaseClient;

  return { client, store };
}

// ---------------------------------------------------------------------------
// seedInvestorDemoScenario
// ---------------------------------------------------------------------------

describe("seedInvestorDemoScenario", () => {
  it("inserts every section of INVESTOR_DEMO_SCENARIO", async () => {
    const { client, store } = makeMemorySupabase();
    const result = await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.scenario).toBe(1);
    expect(result.counts.client).toBe(1);
    expect(result.counts.assets).toBe(INVESTOR_DEMO_SCENARIO.assets.length);
    expect(result.counts.events).toBe(INVESTOR_DEMO_SCENARIO.timeline.length);
    expect(result.counts.reasoning).toBe(INVESTOR_DEMO_SCENARIO.reasoning.length);
    expect(result.counts.actions).toBe(INVESTOR_DEMO_SCENARIO.actions.length);
    expect(result.counts.report_templates).toBe(
      INVESTOR_DEMO_SCENARIO.report_templates.length,
    );
    expect(result.counts.metrics).toBe(INVESTOR_DEMO_SCENARIO.metrics.length);

    expect(store.rows.get("demo_scenarios")?.length).toBe(1);
    expect(store.rows.get("demo_clients")?.length).toBe(1);
    expect(store.rows.get("demo_assets")?.length).toBe(4);
    expect(store.rows.get("demo_events")?.length).toBe(15);
    expect(store.rows.get("demo_agent_reasoning")?.length).toBe(3);
    expect(store.rows.get("demo_actions")?.length).toBe(4);
    expect(store.rows.get("demo_reports")?.length).toBe(2);
    expect(store.rows.get("demo_metrics")?.length).toBe(7);
  });

  it("seeds every event with status='pending' and emitted_at=null", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    for (const event of store.rows.get("demo_events") ?? []) {
      expect(event.status).toBe("pending");
      expect(event.emitted_at).toBeNull();
    }
  });

  it("seeds every action with status='pending' and confirmed=false", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    for (const action of store.rows.get("demo_actions") ?? []) {
      expect(action.status).toBe("pending");
      expect(action.confirmed).toBe(false);
      expect(action.executed_at).toBeNull();
    }
  });

  it("is idempotent — running seed twice never duplicates rows", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    const beforeCounts = {
      scenarios: store.rows.get("demo_scenarios")?.length,
      clients: store.rows.get("demo_clients")?.length,
      assets: store.rows.get("demo_assets")?.length,
      events: store.rows.get("demo_events")?.length,
      reasoning: store.rows.get("demo_agent_reasoning")?.length,
      actions: store.rows.get("demo_actions")?.length,
      reports: store.rows.get("demo_reports")?.length,
      metrics: store.rows.get("demo_metrics")?.length,
    };
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    expect({
      scenarios: store.rows.get("demo_scenarios")?.length,
      clients: store.rows.get("demo_clients")?.length,
      assets: store.rows.get("demo_assets")?.length,
      events: store.rows.get("demo_events")?.length,
      reasoning: store.rows.get("demo_agent_reasoning")?.length,
      actions: store.rows.get("demo_actions")?.length,
      reports: store.rows.get("demo_reports")?.length,
      metrics: store.rows.get("demo_metrics")?.length,
    }).toEqual(beforeCounts);
  });

  it("preserves generated reports (non-template) when re-seeding", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    // Pretend the run inserted a generated report
    const genReports = store.rows.get("demo_reports")!;
    genReports.push({
      id: "gen-1",
      scenario_key: INVESTOR_DEMO_SCENARIO.scenario_key,
      report_type: "executive",
      title: "Acme Dental: ransomware precursor contained in 33s",
      summary: "generated by run",
      report_json: { is_seed_template: false },
      created_at: new Date().toISOString(),
    });

    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const reportsAfter = store.rows.get("demo_reports") ?? [];
    expect(reportsAfter.find((r) => r.id === "gen-1")).toBeDefined();
    expect(
      reportsAfter.filter((r) =>
        String(r.title).startsWith(INVESTOR_DEMO_SEED_REPORT_PREFIX),
      ).length,
    ).toBe(2);
  });

  it("captures supabase errors into result.errors but does not throw", async () => {
    const { client, store } = makeMemorySupabase();
    store.errors.set("insert:demo_assets", "simulated failure");
    const result = await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("simulated failure"))).toBe(true);
    expect(result.counts.assets).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runInvestorDemoScenario
// ---------------------------------------------------------------------------

interface FakeClock extends RunInvestorDemoClock {
  totalSlept: number;
  /** Current virtual time in ms. */
  virtualNow: number;
}

function makeFakeClock(): FakeClock {
  const c: FakeClock = {
    totalSlept: 0,
    virtualNow: 0,
    now() {
      return c.virtualNow;
    },
    async sleep(ms: number) {
      c.totalSlept += ms;
      c.virtualNow += ms;
    },
  };
  return c;
}

function makeCapturingLogger(): RunInvestorDemoLogger & {
  messages: Array<{ message: string; ctx?: Record<string, unknown> }>;
} {
  const messages: Array<{ message: string; ctx?: Record<string, unknown> }> = [];
  return {
    messages,
    info(message, ctx) {
      messages.push({ message, ...(ctx ? { ctx } : {}) });
    },
  };
}

describe("runInvestorDemoScenario", () => {
  it("flips scenario status ready→running→completed and emits every event", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const logger = makeCapturingLogger();
    const clock = makeFakeClock();
    const result = await runInvestorDemoScenario(
      { logger, clock },
      client,
    );

    expect(result.ok).toBe(true);
    expect(result.emittedEventCount).toBe(15);
    expect(result.errors).toEqual([]);

    const scenario = store.rows
      .get("demo_scenarios")
      ?.find(
        (r) => r.scenario_key === INVESTOR_DEMO_SCENARIO.scenario_key,
      );
    expect(scenario?.status).toBe("completed");

    for (const event of store.rows.get("demo_events") ?? []) {
      expect(event.status).toBe("emitted");
      expect(event.emitted_at).not.toBeNull();
    }
    expect(result.finalMetrics.length).toBe(
      INVESTOR_DEMO_SCENARIO.metrics.length,
    );
    expect(logger.messages.length).toBe(15);
  });

  it("respects speedMultiplier — 10x finishes in roughly 5.5 virtual seconds", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const clock = makeFakeClock();
    await runInvestorDemoScenario(
      { logger: makeCapturingLogger(), clock, speedMultiplier: 10 },
      client,
    );
    // Last event is at offset 55s; at 10x that's 5.5s ≈ 5500ms.
    expect(clock.totalSlept).toBeLessThanOrEqual(5500);
  });

  it("rejects non-positive speedMultipliers", async () => {
    const { client } = makeMemorySupabase();
    await expect(
      runInvestorDemoScenario({ speedMultiplier: 0 }, client),
    ).rejects.toThrow(/invalid speedMultiplier/);
  });
});

// ---------------------------------------------------------------------------
// resetInvestorDemoScenario — the headline round-trip test
// ---------------------------------------------------------------------------

describe("resetInvestorDemoScenario", () => {
  it("fully restores the scenario after a complete run", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    // Capture the post-seed state we expect reset to restore us back to.
    const seededEventStatuses = (store.rows.get("demo_events") ?? []).map(
      (e) => ({ event_order: e.event_order, status: e.status, emitted_at: e.emitted_at }),
    );
    const seededActionStatuses = (store.rows.get("demo_actions") ?? []).map(
      (a) => ({
        action_type: a.action_type,
        status: a.status,
        confirmed: a.confirmed,
        executed_at: a.executed_at,
        result_summary: a.result_summary,
      }),
    );
    const seededAssetStatuses = (store.rows.get("demo_assets") ?? []).map(
      (a) => ({ asset_name: a.asset_name, status: a.status }),
    );

    // Run the demo end-to-end so events fire, scenario goes to 'completed', etc.
    await runInvestorDemoScenario(
      { logger: makeCapturingLogger(), clock: makeFakeClock() },
      client,
    );

    // Mutate the rest of the per-run state the way the live demo would:
    // - mark one asset isolated, mark one action executed, insert a generated report
    const assets = store.rows.get("demo_assets")!;
    const laptop = assets.find((a) => a.asset_name === "LAPTOP-123")!;
    laptop.status = "isolated";

    const actions = store.rows.get("demo_actions")!;
    const isolate = actions.find((a) => a.action_type === "isolate_endpoint")!;
    isolate.status = "executed";
    isolate.confirmed = true;
    isolate.executed_at = new Date().toISOString();
    isolate.result_summary = "isolated (simulated)";

    const reports = store.rows.get("demo_reports")!;
    reports.push({
      id: "gen-exec",
      scenario_key: INVESTOR_DEMO_SCENARIO.scenario_key,
      report_type: "executive",
      title: "Acme Dental: contained in 33s",
      summary: "generated by run",
      report_json: { is_seed_template: false },
      created_at: new Date().toISOString(),
    });

    // Now reset and verify everything is back to the seeded state.
    const resetResult = await resetInvestorDemoScenario(
      INVESTOR_DEMO_SCENARIO.scenario_key,
      client,
    );
    expect(resetResult.ok).toBe(true);
    expect(resetResult.errors).toEqual([]);
    expect(Object.values(resetResult.reset).every((v) => v === true)).toBe(true);

    const scenario = store.rows
      .get("demo_scenarios")
      ?.find((r) => r.scenario_key === INVESTOR_DEMO_SCENARIO.scenario_key);
    expect(scenario?.status).toBe("ready");

    const eventStatusesAfter = (store.rows.get("demo_events") ?? []).map(
      (e) => ({ event_order: e.event_order, status: e.status, emitted_at: e.emitted_at }),
    );
    expect(eventStatusesAfter).toEqual(seededEventStatuses);

    const actionStatusesAfter = (store.rows.get("demo_actions") ?? []).map(
      (a) => ({
        action_type: a.action_type,
        status: a.status,
        confirmed: a.confirmed,
        executed_at: a.executed_at,
        result_summary: a.result_summary,
      }),
    );
    expect(actionStatusesAfter).toEqual(seededActionStatuses);

    const assetStatusesAfter = (store.rows.get("demo_assets") ?? []).map(
      (a) => ({ asset_name: a.asset_name, status: a.status }),
    );
    expect(assetStatusesAfter).toEqual(seededAssetStatuses);

    // Templates preserved, generated reports gone.
    const reportsAfter = store.rows.get("demo_reports") ?? [];
    expect(reportsAfter.length).toBe(2);
    for (const r of reportsAfter) {
      expect(String(r.title).startsWith(INVESTOR_DEMO_SEED_REPORT_PREFIX)).toBe(true);
    }
    expect(reportsAfter.find((r) => r.id === "gen-exec")).toBeUndefined();
  });

  it("captures supabase errors per step and reports a clean failure", async () => {
    const { client, store } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);
    store.errors.set("update:demo_actions", "actions reset failed");

    const result = await resetInvestorDemoScenario(
      INVESTOR_DEMO_SCENARIO.scenario_key,
      client,
    );
    expect(result.ok).toBe(false);
    expect(result.reset.action_statuses).toBe(false);
    expect(result.reset.event_statuses).toBe(true);
    expect(result.errors[0]).toMatch(/actions reset failed/);
  });
});

// ---------------------------------------------------------------------------
// Sanity: spy logger receives properly-formatted messages
// ---------------------------------------------------------------------------

describe("run logger output shape", () => {
  it("formats each line with offset + event_type + title", async () => {
    const { client } = makeMemorySupabase();
    await seedInvestorDemoScenario(INVESTOR_DEMO_SCENARIO, client);

    const logger = {
      info: vi.fn(),
    } satisfies RunInvestorDemoLogger;

    await runInvestorDemoScenario(
      { logger, clock: makeFakeClock() },
      client,
    );

    expect(logger.info).toHaveBeenCalledTimes(15);
    const firstCall = logger.info.mock.calls[0]!;
    expect(firstCall[0]).toMatch(/^\[demo:run\] \+0s — demo_started:/);
  });
});
