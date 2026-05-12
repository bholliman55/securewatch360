/**
 * CLI: npm run sim:run-all
 */

import { executeAllScenarioSimulations } from "../engines/simulationRunner";
import { defaultSimulationReportOutputDir } from "../reports/reportGenerator";
import { parseCliArgs, defaultSimulationResultsDir } from "./shared";

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  process.env.SIMULATION_AGENT_WAIT_MS ??= "0";
  process.env.SIMULATION_MODE ??= "local";

  const cwd = process.cwd();
  console.log("Running all simulator scenarios...\n");

  const results = await executeAllScenarioSimulations({
    simulationDemoMode: args.demo === true,
  });

  let fails = 0;
  for (const r of results) {
    const ok = r.result.passed ? "PASS" : "FAIL";
    if (!r.result.passed) fails += 1;
    console.log(`${ok}  ${r.scenario.id.padEnd(40)} runId=${r.result.runId}`);
  }

  console.log("");
  console.log(`Done. ${results.length - fails}/${results.length} passed.`);
  console.log(`Artifacts: ${defaultSimulationResultsDir(cwd)}`);
  console.log(`Human reports: ${defaultSimulationReportOutputDir(cwd)}`);

  process.exitCode = fails > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
