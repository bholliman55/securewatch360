import { loadEnvConfig } from "@next/env";
import { fetchSemgrepFindings } from "../src/scanner/connectors/semgrep";
import { fetchTenableFindings } from "../src/scanner/connectors/tenable";
import type { ScanTargetInput } from "../src/scanner/types";

loadEnvConfig(process.cwd());

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runTenableCheck(): Promise<void> {
  const targetValue = process.env.QA_TENABLE_TARGET?.trim();
  if (!targetValue) {
    console.log("[qa-v1-connectors-real] skip Tenable check (set QA_TENABLE_TARGET to enable)");
    return;
  }

  assert(process.env.TENABLE_ACCESS_KEY, "Missing TENABLE_ACCESS_KEY");
  assert(process.env.TENABLE_SECRET_KEY, "Missing TENABLE_SECRET_KEY");

  const target: ScanTargetInput = {
    tenantId: process.env.TEST_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000000",
    scanTargetId: "qa-tenable-real",
    targetType: "hostname",
    targetValue,
  };

  const findings = await fetchTenableFindings(target);
  console.log(`[qa-v1-connectors-real] Tenable findings: ${findings.length}`);
}

async function runSemgrepCheck(): Promise<void> {
  const repo = process.env.QA_SEMGREP_REPO?.trim();
  if (!repo) {
    console.log("[qa-v1-connectors-real] skip Semgrep check (set QA_SEMGREP_REPO to enable)");
    return;
  }

  assert(process.env.SEMGREP_APP_TOKEN, "Missing SEMGREP_APP_TOKEN");

  const target: ScanTargetInput = {
    tenantId: process.env.TEST_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000000",
    scanTargetId: "qa-semgrep-real",
    targetType: "repo",
    targetValue: repo,
  };

  const findings = await fetchSemgrepFindings(target);
  console.log(`[qa-v1-connectors-real] Semgrep findings: ${findings.length}`);
}

async function main() {
  await runTenableCheck();
  await runSemgrepCheck();
  console.log("[qa-v1-connectors-real] PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[qa-v1-connectors-real] FAIL: ${message}`);
  process.exit(1);
});
