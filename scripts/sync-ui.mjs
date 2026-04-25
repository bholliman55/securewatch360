import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "ui", "dist");
const out = join(root, "public", "console");

if (!existsSync(join(dist, "index.html"))) {
  console.error("Missing ui/dist/index.html — run the Vite build first (e.g. npm run ui:build).");
  process.exit(1);
}

mkdirSync(join(root, "public"), { recursive: true });
rmSync(out, { recursive: true, force: true });
cpSync(dist, out, { recursive: true });
console.log("Synced ui/dist -> public/console");
