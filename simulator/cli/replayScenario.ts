/**
 * CLI: npm run sim:replay -- --runId <uuid>
 * Reconstructs forensic timeline + incident reconstruction from persisted simulation artifacts.
 */

import {
  parseCliArgs,
  defaultScenariosDir,
  defaultSimulationResultsDir,
  loadPersistedSimulationBundle,
  findScenarioDefinitionById,
} from "./shared";
import {
  reconstructForensicTimeline,
  persistForensicTimelineArtifacts,
} from "../forensics/timelineReconstructor";

async function main() {
  const cwd = process.cwd();
  const args = parseCliArgs(process.argv.slice(2));
  const runIdRaw =
    (typeof args.runId === "string" && args.runId.trim()) ||
    (typeof args.run_id === "string" && args.run_id.trim()) ||
    "";

  if (!runIdRaw) {
    console.error("Usage: npm run sim:replay -- --runId <simulation-run-uuid>");
    process.exitCode = 2;
    return;
  }

  const resultsDir =
    (typeof args.outDir === "string" && args.outDir.trim()) ||
    (typeof args.resultsDir === "string" && args.resultsDir.trim()) ||
    defaultSimulationResultsDir(cwd);

  const bundle = await loadPersistedSimulationBundle(runIdRaw, resultsDir);
  if (!bundle) {
    console.error(`No result file ${runIdRaw}-simulation-result.json under ${resultsDir}`);
    process.exitCode = 2;
    return;
  }

  const scenario = await findScenarioDefinitionById(bundle.run.scenarioId, defaultScenariosDir(cwd));

  const document = reconstructForensicTimeline({
    run: bundle.run,
    result: bundle.result,
    scenario: scenario ?? null,
    structuredReport: bundle.structuredReport,
  });

  const paths = await persistForensicTimelineArtifacts({
    runId: runIdRaw,
    document,
    baseDir: resultsDir,
  });

  console.log("Forensic timeline artifacts written:");
  console.log(`  ${paths.jsonPath}`);
  console.log(`  ${paths.timelineMdPath}`);
  console.log(`  ${paths.reconstructionMdPath}`);
  console.log("");
  console.log(`Events in timeline: ${document.events.length}`);
  console.log(`Transitions recorded: ${document.event_transitions.length}`);
  const a = document.anomalies;
  const anomalyCount =
    a.duplicate_event_hashes.length + a.orphaned_parent_references.length + a.missing_workflow_transitions.length;
  console.log(`Anomaly signals: ${anomalyCount}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
