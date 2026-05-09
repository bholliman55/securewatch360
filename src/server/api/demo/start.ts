/**
 * `POST /api/demo/start` service handler.
 *
 * Asks the singleton replay store to start (or reuse) an investor-demo
 * replay handle. The actual replay runs in a detached promise inside the
 * engine; this handler returns synchronously with the run's initial
 * state.
 *
 * Inputs:
 *   - speedMultiplier: defaults to 1; clamped to (0, +∞)
 *   - instant: defaults to false; if true, every wait is skipped
 */

import { startReplay } from "@/server/demo/investorReplayStore";

import type {
  DemoServiceDeps,
  StartInput,
  StartResult,
} from "./types";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

export async function handleStart(
  input: StartInput = {},
  deps: DemoServiceDeps = {},
): Promise<StartResult> {
  const errors: string[] = [];
  const speedMultiplier =
    typeof input.speedMultiplier === "number" &&
    Number.isFinite(input.speedMultiplier) &&
    input.speedMultiplier > 0
      ? input.speedMultiplier
      : 1;
  const instant = input.instant === true;

  // The store-like passed by tests has the same signature; production code
  // calls the module-level singleton directly.
  const store =
    deps.replayStore ??
    ({
      startReplay: (opts) => startReplay(opts),
    } satisfies Pick<NonNullable<DemoServiceDeps["replayStore"]>, "startReplay">);

  try {
    const { handle, reused } = store.startReplay({ speedMultiplier, instant });
    return {
      ok: true,
      scenarioKey: handle.scenarioKey,
      state: handle.state(),
      speedMultiplier,
      instant,
      reused,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      ok: false,
      scenarioKey: INVESTOR_DEMO_SCENARIO.scenario_key,
      state: "failed",
      speedMultiplier,
      instant,
      reused: false,
      errors,
    };
  }
}
