/**
 * Reset service for the investor demo.
 *
 * Provides a one-call surface used by `npm run demo:stack` and the demo
 * UI's "reset" button. Wipes every persisted demo event for the scenario
 * and re-arms the seed snapshot. Safe to run mid-presentation: the
 * function never throws on transient sink failures, returns a structured
 * result instead.
 */

import { DEMO_SCENARIO_ID, resolveDemoSink } from "./demoConfig";
import { getDemoSeed, type DemoSeedSnapshot } from "./demoSeedData";
import { assertTimelineInvariants } from "./demoScenario";
import type { DemoEventSink } from "./demoEventTypes";

export interface ResetDemoOptions {
  /** Sink override, mostly used by tests. */
  sink?: DemoEventSink;
  /**
   * Scenario id to wipe. Defaults to the canonical one. Exposed so
   * future scenarios can plug into the same reset machinery.
   */
  scenarioId?: string;
}

export interface ResetDemoResult {
  ok: boolean;
  scenarioId: string;
  sink: DemoEventSink["kind"];
  /** Seed snapshot the demo is now armed with. */
  seed: DemoSeedSnapshot;
  /** Wall-clock ISO timestamp the reset completed at. */
  resetAt: string;
  /** Populated when something went wrong. `ok` will be `false`. */
  error?: string;
}

/**
 * Reset the demo state. The sink is responsible for the actual delete;
 * this orchestrator just calls it and re-validates timeline invariants
 * so an accidental edit to the canonical timeline is caught at reset
 * time rather than at the next investor session.
 */
export async function resetDemo(
  options: ResetDemoOptions = {},
): Promise<ResetDemoResult> {
  const sink = options.sink ?? resolveDemoSink();
  const scenarioId = options.scenarioId ?? DEMO_SCENARIO_ID;

  try {
    assertTimelineInvariants();
    await sink.reset(scenarioId);
    return {
      ok: true,
      scenarioId,
      sink: sink.kind,
      seed: getDemoSeed(),
      resetAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return {
      ok: false,
      scenarioId,
      sink: sink.kind,
      seed: getDemoSeed(),
      resetAt: new Date().toISOString(),
      error: message,
    };
  }
}

/**
 * One-line convenience for CLI scripts:
 *
 *   `npx tsx -e "require('@/demo/investorMode/demoResetService').runResetCli()"`
 */
export async function runResetCli(): Promise<void> {
  const result = await resetDemo();
  // Intentional console output — this is the CLI surface.
  console.log(JSON.stringify(result, null, 2));
}
