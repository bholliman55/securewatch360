/**
 * Compliance scoring from control evaluation outcomes (per framework and overall).
 */

import type { SupportedVerificationFramework } from "./frameworks";
import {
  FRAMEWORK_DISPLAY_NAME,
  REPRESENTATIVE_CONTROL_CATALOG,
  VERIFICATION_FRAMEWORK_ORDER,
  parseControlKey,
} from "./frameworks";
import type { ControlPosture } from "./driftDetection";

export type FrameworkComplianceScore = {
  framework: SupportedVerificationFramework;
  display_name: string;
  controls_evaluated: number;
  controls_passing: number;
  score_pct: number;
};

export type ComplianceScoringResult = {
  overall_score_pct: number;
  by_framework: FrameworkComplianceScore[];
  weights_equal: boolean;
};

function postureScore(p: ControlPosture | undefined): number {
  if (p === "pass") return 1;
  if (p === "fail") return 0;
  return 0.5;
}

/**
 * Weight-unknown at 0.5 so drift drills do not collapse to zero when probes are incomplete.
 */
export function computeComplianceScores(args: {
  observed: Record<string, ControlPosture>;
  frameworks?: SupportedVerificationFramework[];
}): ComplianceScoringResult {
  const fromObserved = Array.from(
    new Set(
      Object.keys(args.observed)
        .map((k) => parseControlKey(k)?.framework)
        .filter((x): x is SupportedVerificationFramework => Boolean(x)),
    ),
  );

  const frameworks =
    args.frameworks ?? (fromObserved.length > 0 ? fromObserved : [...VERIFICATION_FRAMEWORK_ORDER]);

  const by_framework: FrameworkComplianceScore[] = [];

  const fwList =
    frameworks.length > 0 ? frameworks : (Object.keys(REPRESENTATIVE_CONTROL_CATALOG) as SupportedVerificationFramework[]);

  for (const fw of fwList) {
    const catalog = REPRESENTATIVE_CONTROL_CATALOG[fw];
    let passing = 0;
    let evaluated = 0;
    let sum = 0;

    for (const cid of catalog) {
      const key = `${fw}:${cid}`;
      const p = args.observed[key];
      if (p === undefined) continue;
      evaluated += 1;
      const s = postureScore(p);
      sum += s;
      if (p === "pass") passing += 1;
    }

    const score_pct =
      evaluated === 0 ? 100 : Math.round((sum / evaluated) * 1000) / 10;

    by_framework.push({
      framework: fw,
      display_name: FRAMEWORK_DISPLAY_NAME[fw],
      controls_evaluated: evaluated,
      controls_passing: passing,
      score_pct,
    });
  }

  const overall_score_pct =
    by_framework.length === 0
      ? 100
      : Math.round(
          (by_framework.reduce((a, b) => a + b.score_pct, 0) / by_framework.length) * 10,
        ) / 10;

  return {
    overall_score_pct,
    by_framework,
    weights_equal: true,
  };
}
