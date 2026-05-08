/**
 * Configuration + sink resolution for the investor demo.
 *
 * Keeps environment lookups out of the replay engine itself so the engine
 * can be unit-tested with an in-memory sink. In production the resolver
 * upgrades to a Supabase-backed sink when both `NEXT_PUBLIC_SUPABASE_URL`
 * and `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise everything stays in
 * memory and the demo still runs cleanly on a developer laptop.
 */

import type { DemoEvent, DemoEventSink } from "./demoEventTypes";

// ---------------------------------------------------------------------------
// Static configuration constants
// ---------------------------------------------------------------------------

/** Stable scenario id for the Acme Dental ransomware-precursor demo. */
export const DEMO_SCENARIO_ID = "ransomware-precursor-acme-dental" as const;

/**
 * Synthetic tenant UUID used for every demo write. Lives in the demo
 * namespace (`...ffffffffd0xx`) so it is trivial to filter out of
 * production analytics. Never reuse for a real customer.
 */
export const DEMO_TENANT_ID = "b2c7d5e9-6014-5a8b-bc11-ffffffffd001" as const;

/** Action prefix written to the `audit_logs` row when the Supabase sink is used. */
export const DEMO_AUDIT_ACTION_PREFIX = "demo." as const;

/**
 * Default speed multiplier (1.0 = real-time). Demo screens may pass higher
 * values for rehearsal, e.g. 5x or 10x.
 */
export const DEFAULT_DEMO_SPEED_MULTIPLIER = 1.0;

// ---------------------------------------------------------------------------
// In-memory sink (always available, used as fallback)
// ---------------------------------------------------------------------------

/**
 * Process-local store. Keyed by `demoRunId` so multiple concurrent demo
 * runs (e.g. two browser tabs in dev) don't interfere with each other.
 */
const memoryStore = new Map<string, DemoEvent[]>();

export function createInMemoryDemoSink(): DemoEventSink {
  return {
    kind: "memory",
    async persist(event: DemoEvent): Promise<void> {
      const bucket = memoryStore.get(event.demoRunId) ?? [];
      bucket.push(event);
      bucket.sort((a, b) => a.step - b.step);
      memoryStore.set(event.demoRunId, bucket);
    },
    async list(demoRunId: string): Promise<DemoEvent[]> {
      return [...(memoryStore.get(demoRunId) ?? [])];
    },
    async reset(scenarioId: string): Promise<void> {
      for (const [runId, events] of memoryStore.entries()) {
        if (events.some((e) => e.scenarioId === scenarioId)) {
          memoryStore.delete(runId);
        }
      }
    },
  };
}

/**
 * Test helper — resets the module-level memory store so tests don't leak
 * state into each other. Not exported from the package barrel; consumers
 * outside the test suite should use the sink's own `reset()`.
 */
export function __resetInMemoryStoreForTests(): void {
  memoryStore.clear();
}

// ---------------------------------------------------------------------------
// Supabase sink (lazy-loaded — never imported on the client)
// ---------------------------------------------------------------------------

/**
 * Lazy build a Supabase-backed sink. Persists each event as a row in
 * `audit_logs` with `entity_type='system'`, `entity_id=demoRunId`, and
 * the full {@link DemoEvent} stashed in `payload`. We deliberately reuse
 * the audit ledger so investor demos don't require a brand-new migration —
 * resets simply delete by the same payload key.
 *
 * Returns `null` when Supabase env vars are missing, allowing callers to
 * fall back to the in-memory sink without throwing.
 */
function tryCreateSupabaseSink(): DemoEventSink | null {
  if (typeof window !== "undefined") return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  let getAdmin: (() => unknown) | null = null;
  try {
    // Dynamically resolve to avoid pulling Supabase into client bundles
    // and to keep the unit tests free of any module-load side effects.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/lib/supabase") as {
      getSupabaseAdminClient: () => unknown;
    };
    getAdmin = mod.getSupabaseAdminClient;
  } catch {
    return null;
  }

  return {
    kind: "supabase",
    async persist(event: DemoEvent): Promise<void> {
      try {
        const client = getAdmin!() as {
          from: (t: string) => {
            insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
          };
        };
        const { error } = await client.from("audit_logs").insert({
          user_id: null,
          tenant_id: DEMO_TENANT_ID,
          entity_type: "system",
          entity_id: event.demoRunId,
          action: `${DEMO_AUDIT_ACTION_PREFIX}${event.type}`,
          summary: event.title,
          payload: event,
        });
        if (error) {
          console.error("[demo] supabase persist failed", error);
        }
      } catch (err) {
        console.error("[demo] supabase persist threw", err);
      }
    },
    async list(demoRunId: string): Promise<DemoEvent[]> {
      try {
        const client = getAdmin!() as {
          from: (t: string) => {
            select: (q: string) => {
              eq: (col: string, val: string) => {
                eq: (col: string, val: string) => Promise<{
                  data: Array<{ payload: DemoEvent }> | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
        const { data, error } = await client
          .from("audit_logs")
          .select("payload")
          .eq("entity_type", "system")
          .eq("entity_id", demoRunId);
        if (error || !data) return [];
        return data
          .map((r) => r.payload)
          .filter((e): e is DemoEvent => Boolean(e && typeof e === "object"))
          .sort((a, b) => a.step - b.step);
      } catch (err) {
        console.error("[demo] supabase list threw", err);
        return [];
      }
    },
    async reset(scenarioId: string): Promise<void> {
      try {
        const client = getAdmin!() as {
          from: (t: string) => {
            delete: () => {
              eq: (col: string, val: string) => {
                like: (col: string, val: string) => Promise<{ error: unknown }>;
              };
            };
          };
        };
        const { error } = await client
          .from("audit_logs")
          .delete()
          .eq("entity_type", "system")
          .like("action", `${DEMO_AUDIT_ACTION_PREFIX}%`);
        if (error) {
          console.error("[demo] supabase reset failed", { scenarioId, error });
        }
      } catch (err) {
        console.error("[demo] supabase reset threw", err);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Public sink resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the active sink. Prefers Supabase when configured; otherwise
 * returns the in-memory sink. Cheap to call repeatedly — Supabase client
 * construction itself is cached inside `getSupabaseAdminClient()`.
 */
export function resolveDemoSink(): DemoEventSink {
  return tryCreateSupabaseSink() ?? createInMemoryDemoSink();
}
