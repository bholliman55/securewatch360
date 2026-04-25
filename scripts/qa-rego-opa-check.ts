import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const REPO = process.cwd();
const REGO_SEED = path.join(REPO, "policies", "rego", "seed");
const REGO_EX = path.join(REPO, "policies", "rego", "securewatch360");

function canRunOpa(): boolean {
  return spawnSync("opa", ["version"], { stdio: "ignore" }).status === 0;
}

function main() {
  const requireOpa = process.env.CI === "true" || process.env.REQUIRE_OPA === "1";
  if (!canRunOpa()) {
    if (requireOpa) {
      throw new Error("opa CLI is required; install from https://www.openpolicyagent.org/ and re-run");
    }
    console.warn("[qa-rego] opa not on PATH; install OPA to validate Rego syntax (set CI=1 to fail if missing)");
    return;
  }

  for (const dir of [REGO_SEED, REGO_EX]) {
    const r = spawnSync("opa", ["check", dir], { cwd: REPO, stdio: "inherit" });
    if (r.status !== 0) {
      throw new Error(`[qa-rego] opa check failed for ${dir}`);
    }
  }

  console.info("[qa-rego] PASS — OPA check on policies/rego/seed and policies/rego/securewatch360");
}

try {
  main();
} catch (e: unknown) {
  console.error("[qa-rego] FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
}
