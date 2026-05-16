import { collectInventory } from "./collector";
import { writeInventory } from "./outputWriter";

async function main() {
  const report = await collectInventory();
  const filePath = await writeInventory(report);
  console.log(`Inventory report written to ${filePath}`);
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  main().catch((error) => {
    console.error("Collector failed:", error);
    process.exit(1);
  });
}
