/**
 * CLI: npm run sim:run -- --scenario <fixture_stem_or_id>
 */

import { executeScenarioSimulation } from "../engines/simulationRunner";
import {
  parseCliArgs,
  defaultScenariosDir,
  resolveScenarioFromSpecifier,
  defaultSimulationResultsDir,
} from "./shared";

async function main() {
  process.env.SIMULATION_AGENT_WAIT_MS ??= "0";
  process.env.SIMULATION_MODE ??= "local";

  const cwd = process.cwd();
  const args = parseCliArgs(process.argv.slice(2));
  const specArg = typeof args.scenario === "string" ? args.scenario.trim() : "";
  if (!specArg) {
    console.error(`Usage: npm run sim:run -- --scenario <fixture_stem|scenario_id|path.json>`);
    process.exitCode = 2;
    return;
  }

  const scenariosDir = defaultScenariosDir(cwd);
  const resolved = await resolveScenarioFromSpecifier(specArg, scenariosDir);
  if (!resolved) {
    console.error(`Scenario not found: "${specArg}"`);
    console.error(`Looked under: ${scenariosDir}`);
    console.error("Hint: npm run sim:list");
    process.exitCode = 2;
    return;
  }

  console.log(`Running scenario: ${resolved.definition.id} (${resolved.stem}.json)`);
  const lab = await executeScenarioSimulation(resolved.definition, {});
  console.log(`${lab.result.passed ? "PASS" : "FAIL"}  runId=${lab.result.runId}  scenario=${lab.scenario.name}`);
  console.log(`Results: ${defaultSimulationResultsDir(cwd)}`);
  if (lab.persisted?.resultPath) console.log(`  artifact: ${lab.persisted.resultPath}`);
  if (lab.persisted?.reportPath) console.log(`  report: ${lab.persisted.reportPath}`);
  if (lab.persisted?.humanReportMarkdownPath)
    console.log(`  markdown: ${lab.persisted.humanReportMarkdownPath}`);

  if (!lab.result.passed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
