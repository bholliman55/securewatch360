/**
 * Shared in-memory Supabase facade for investor-demo unit tests.
 *
 * Implements just enough of the supabase-js builder surface to drive the
 * seed → run → reset → replay flows end-to-end without a real database.
 *
 *   - eq / like / not('like', …) filters
 *   - order(column, { ascending })
 *   - select / single / maybeSingle
 *   - insert / update / delete / upsert (with onConflict composite keys)
 *
 * Per-(op, table) error injection is exposed via `store.errors` so tests
 * can verify failure paths without hand-rolling a fragile mock.
 *
 * Filename starts with `_` so vitest's default `*.test.ts` glob ignores it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
export type Op = "select" | "insert" | "update" | "delete" | "upsert";

export interface MemoryStore {
  rows: Map<string, Row[]>;
  /** Map of `${op}:${table}` → forced error message (single-shot or persistent). */
  errors: Map<string, string>;
}

interface Filter {
  kind: "eq" | "like" | "not_like";
  column: string;
  value: unknown;
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

function rowMatches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (f.kind === "eq") return row[f.column] === f.value;
    if (f.kind === "like") {
      return typeof row[f.column] === "string"
        ? matchSqlLike(row[f.column] as string, String(f.value))
        : false;
    }
    return typeof row[f.column] === "string"
      ? !matchSqlLike(row[f.column] as string, String(f.value))
      : true;
  });
}

interface Result {
  data: unknown;
  error: unknown;
}

interface BuilderNode extends PromiseLike<Result> {
  eq(column: string, value: unknown): BuilderNode;
  like(column: string, value: unknown): BuilderNode;
  not(column: string, operator: string, value: unknown): BuilderNode;
  order(column: string, opts?: { ascending?: boolean }): PromiseLike<Result>;
  select(): BuilderNode;
  single(): Promise<Result>;
  maybeSingle(): Promise<Result>;
}

export interface MemorySupabaseHandle {
  client: SupabaseClient;
  store: MemoryStore;
}

export function makeMemorySupabase(): MemorySupabaseHandle {
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

  const startCall = (op: Op, table: string, values?: Row | Row[]): BuilderNode => {
    const filters: Filter[] = [];
    let resolved: Result | null = null;

    const resolve = async (mode: "withSelect" | "noSelect"): Promise<Result> => {
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
          const { __onConflict: _drop, ...clean } = v as Row & {
            __onConflict?: string;
          };
          void _drop;
          const idx = rows.findIndex((r) => keys.every((k) => r[k] === clean[k]));
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
        data: mode === "withSelect" ? affected : (affected[0] ?? null),
        error: null,
      };
      return resolved;
    };

    const buildNode = (mode: "withSelect" | "noSelect"): BuilderNode => {
      const self: BuilderNode = {
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
          return resolve(mode).then(onfulfilled, onrejected);
        },
        eq(column, value) {
          filters.push({ kind: "eq", column, value });
          return buildNode(mode);
        },
        like(column, value) {
          filters.push({ kind: "like", column, value });
          return buildNode(mode);
        },
        not(column, operator, value) {
          if (operator === "like") {
            filters.push({ kind: "not_like", column, value });
          }
          return buildNode(mode);
        },
        order(column: string, opts?: { ascending?: boolean }) {
          const ascending = opts?.ascending !== false;
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
              return resolve("withSelect")
                .then((res) => {
                  if (res.error || !Array.isArray(res.data)) return res;
                  const sorted = [...(res.data as Row[])].sort((a, b) => {
                    const av = a[column];
                    const bv = b[column];
                    if (av === bv) return 0;
                    if (av == null) return ascending ? -1 : 1;
                    if (bv == null) return ascending ? 1 : -1;
                    if (typeof av === "number" && typeof bv === "number") {
                      return ascending ? av - bv : bv - av;
                    }
                    return ascending
                      ? String(av).localeCompare(String(bv))
                      : String(bv).localeCompare(String(av));
                  });
                  return { data: sorted, error: null };
                })
                .then(onfulfilled, onrejected);
            },
          };
        },
        select() {
          return buildNode("withSelect");
        },
        async single() {
          return resolve("noSelect");
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
          if (opts?.onConflict) {
            if (Array.isArray(values)) {
              for (const v of values) {
                (v as Row & { __onConflict?: string }).__onConflict =
                  opts.onConflict;
              }
            } else {
              (values as Row & { __onConflict?: string }).__onConflict =
                opts.onConflict;
            }
          }
          return startCall("upsert", table, values);
        },
      } as unknown as ReturnType<SupabaseClient["from"]>;
    },
  } as unknown as SupabaseClient;

  return { client, store };
}
