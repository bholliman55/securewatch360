/**
 * Simulated policy drift: compare golden baseline control posture vs observed evaluation.
 */

export type ControlPosture = "pass" | "fail" | "unknown";

export type PolicyDriftResult = {
  /** Was passing in baseline, now fail or unknown */
  driftedControls: string[];
  /** New failures (including from pass -> fail) */
  newFailures: string[];
  /** fail -> pass */
  recoveredControls: string[];
  /** pass in both */
  stablePassing: string[];
  drift_detected: boolean;
};

/**
 * Keys are `framework:controlId` (see `controlKey`) or any stable control identifier.
 */
export function detectPolicyDrift(args: {
  baseline: Record<string, "pass" | "fail">;
  observed: Record<string, ControlPosture>;
}): PolicyDriftResult {
  const driftedControls: string[] = [];
  const newFailures: string[] = [];
  const recoveredControls: string[] = [];
  const stablePassing: string[] = [];

  const keys = new Set([...Object.keys(args.baseline), ...Object.keys(args.observed)]);

  for (const key of keys) {
    const b = args.baseline[key];
    const o = args.observed[key];
    if (b === "pass" && (o === "fail" || o === "unknown")) {
      driftedControls.push(key);
    }
    if (b === "pass" && o === "fail") {
      newFailures.push(key);
    }
    if (b === "fail" && o === "pass") {
      recoveredControls.push(key);
    }
    if (b === "pass" && o === "pass") {
      stablePassing.push(key);
    }
    if (b === undefined && o === "fail") {
      newFailures.push(key);
    }
  }

  return {
    driftedControls,
    newFailures: Array.from(new Set(newFailures)),
    recoveredControls,
    stablePassing,
    drift_detected: driftedControls.length > 0,
  };
}
