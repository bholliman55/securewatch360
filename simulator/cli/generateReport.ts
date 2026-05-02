/**
 * CLI: npm run sim:report -- --runId <uuid>
 * Regenerates human JSON/Markdown from persisted `.simulation-results` artifacts + scenario fixtures.
 */

import { writeSimulationRunReports } from "../reports/reportGenerator";
import {
  parseCliArgs,
  defaultScenariosDir,
  defaultSimulationResultsDir,
  loadPersistedSimulationBundle,
  hydrateReportInputs,
  findScenarioDefinitionById,
  type PersistedSimulationBundle,
} from "./shared";

async function main() {
  const cwd = process.cwd();
  const args = parseCliArgs(process.argv.slice(2));
  const runIdRaw =
    (typeof args.runId === "string" && args.runId.trim()) ||
    (typeof args.run_id === "string" && args.run_id.trim()) ||
    "";

  if (!runIdRaw) {
    console.error("Usage: npm run sim:report -- --runId <simulation-run-uuid>");
    process.exitCode = 2;
    return;
  }

  const resultsDir = defaultSimulationResultsDir(cwd);
  let loaded: PersistedSimulationBundle;
  try {
    const bundle = await loadPersistedSimulationBundle(runIdRaw, resultsDir);
    if (!bundle) {
      console.error(`No result file ${runIdRaw}-simulation-result.json under ${resultsDir}`);
      process.exitCode = 2;
      return;
    }
    loaded = bundle;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 2;
    return;
  }

  let hydrated;
  try {
    hydrated = hydrateReportInputs(loaded.structuredReport);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 2;
    return;
  }

  const scenario = await findScenarioDefinitionById(loaded.run.scenarioId, defaultScenariosDir(cwd));
  if (!scenario) {
    console.error(`Scenario fixture not found for scenarioId=${loaded.run.scenarioId} under ${defaultScenariosDir(cwd)}`);
    process.exitCode = 2;
    return;
  }

  const out = await writeSimulationRunReports({
    scenario,
    run: loaded.run,
    result: loaded.result,
    signals: hydrated.signals,
    emissions: hydrated.emissions,
    autonomyScorecard: hydrated.autonomyScorecard,
    securewatchAgents: hydrated.securewatchAgents,
  });

  console.log(`Reports written:`);
  console.log(`  ${out.jsonPath}`);
  console.log(`  ${out.markdownPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
