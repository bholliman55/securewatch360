/**
 * Framework coverage metrics: evaluated controls vs representative catalog size.
 */

import type { SupportedVerificationFramework } from "./frameworks";
import { FRAMEWORK_DISPLAY_NAME, REPRESENTATIVE_CONTROL_CATALOG } from "./frameworks";

export type FrameworkCoverageMetric = {
  framework: SupportedVerificationFramework;
  display_name: string;
  catalog_controls: number;
  evaluated_controls: number;
  coverage_pct: number;
};

export function computeFrameworkCoverageMetrics(args: {
  evaluatedControlKeys: Set<string> | string[];
  frameworks?: SupportedVerificationFramework[];
}): FrameworkCoverageMetric[] {
  const keys =
    args.evaluatedControlKeys instanceof Set
      ? args.evaluatedControlKeys
      : new Set(args.evaluatedControlKeys);

  const fws =
    args.frameworks ??
    (Object.keys(REPRESENTATIVE_CONTROL_CATALOG) as SupportedVerificationFramework[]);

  const out: FrameworkCoverageMetric[] = [];

  for (const fw of fws) {
    const catalog = REPRESENTATIVE_CONTROL_CATALOG[fw];
    const catalog_controls = catalog.length;
    let evaluated_controls = 0;
    for (const cid of catalog) {
      if (keys.has(`${fw}:${cid}`)) evaluated_controls += 1;
    }
    const coverage_pct =
      catalog_controls === 0
        ? 100
        : Math.round((evaluated_controls / catalog_controls) * 1000) / 10;

    out.push({
      framework: fw,
      display_name: FRAMEWORK_DISPLAY_NAME[fw],
      catalog_controls,
      evaluated_controls,
      coverage_pct,
    });
  }

  return out;
}
