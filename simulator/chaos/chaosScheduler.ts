/**
 * Builds deterministic chaos tick schedules for simulator lab runs.
 */

import {
  CHAOS_SCENARIO_KINDS,
  type ChaosScenarioKind,
  type ChaosScheduleOptions,
  type ChaosTickPlan,
} from "./chaosTypes";

/** Mulberry32 PRNG — deterministic from seed */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/**
 * Produce a sequence of chaos ticks. Cycles through the catalog when ticks > catalog length.
 */
export function buildChaosSchedule(options?: ChaosScheduleOptions): ChaosTickPlan[] {
  const ticks = Math.max(1, options?.ticks ?? CHAOS_SCENARIO_KINDS.length);
  const catalog: ChaosScenarioKind[] = [...CHAOS_SCENARIO_KINDS];

  if (options?.shuffle) {
    const seed = options.seed ?? 42;
    shuffleInPlace(catalog, mulberry32(seed));
  }

  const plans: ChaosTickPlan[] = [];
  for (let i = 0; i < ticks; i += 1) {
    const kind = catalog[i % catalog.length]!;
    plans.push({
      tickIndex: i,
      kind,
      label: `tick_${String(i).padStart(3, "0")}_${kind}`,
    });
  }

  return plans;
}
