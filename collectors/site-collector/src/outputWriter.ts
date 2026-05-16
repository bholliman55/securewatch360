import fs from "fs";
import path from "path";
import { InventoryReport } from "./types";

export function getOutputPath(): string {
  return path.resolve(__dirname, "..", "output", "latest-inventory.json");
}

export async function writeInventory(report: InventoryReport): Promise<string> {
  const outputPath = getOutputPath();
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}
