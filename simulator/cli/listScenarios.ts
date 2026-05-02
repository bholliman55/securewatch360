/**
 * CLI: npm run sim:list
 */

import { defaultScenariosDir, loadScenarioListing } from "./shared";

async function main() {
  const cwd = process.cwd();
  const scenariosDir = defaultScenariosDir(cwd);
  const rows = await loadScenarioListing(scenariosDir);
  if (rows.length === 0) {
    console.log(`No scenario JSON fixtures found under ${scenariosDir}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Scenarios (${rows.length})\n`);
  console.log(
    `${"Fixture (--scenario)".padEnd(42)} ${"Scenario ID".padEnd(38)} ${"Category".padEnd(26)} Sev`,
  );
  console.log("-".repeat(120));

  for (const r of rows) {
    const id = r.definition.id;
    const cat = r.definition.attack_category;
    const sev = r.definition.severity;
    console.log(
      `${r.stem.slice(0, 42).padEnd(42)} ${id.slice(0, 38).padEnd(38)} ${String(cat).slice(0, 26).padEnd(26)} ${sev}`,
    );
  }

  console.log("\nTip: npm run sim:run -- --scenario <stem_without_json>");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
