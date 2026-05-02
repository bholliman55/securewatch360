import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("CLI runScenario (tsx entrypoint)", () => {
  it(
    "invokes simulator/cli/runScenario.ts with SIMULATION_SCENARIOS_DIR pointed at fixtures",
    { timeout: 120_000 },
    async () => {
      const repoRoot = path.join(__dirname, "..", "..");
      const fixturesDir = path.join(__dirname, "fixtures");

      const tmpResults = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-cli-res-"));
      const tmpMd = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-cli-md-"));

      const cliScript = path.join(repoRoot, "simulator/cli/runScenario.ts");
      const tsxCli = path.join(repoRoot, "node_modules/tsx/dist/cli.mjs");

      let combined = "";
      try {
        const res = spawnSync(process.execPath, [tsxCli, cliScript, "--scenario", "mock-minimal-local"], {
          cwd: repoRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            SIMULATION_SCENARIOS_DIR: fixturesDir,
            SIMULATION_AGENT_WAIT_MS: "0",
            SIMULATION_MODE: "local",
            SIMULATION_RESULTS_DIR: tmpResults,
            SIMULATION_REPORT_OUTPUT_DIR: tmpMd,
          },
        });

        combined = `${res.stdout ?? ""}${res.stderr ?? ""}`;
        expect(res.error).toBeUndefined();
        expect(res.status, combined).not.toBeNull();
        expect(combined).toContain("mock-lab-min-local-001");
        expect(combined).toMatch(/runId=[0-9a-f-]{36}/i);

        /** Local lab usually lacks correlated audit/Inngest side-effects unless seeded. */
        expect(combined).toContain("FAIL");
        expect(res.status).toBe(1);
      } finally {
        await fs.rm(tmpResults, { recursive: true, force: true }).catch(() => {});
        await fs.rm(tmpMd, { recursive: true, force: true }).catch(() => {});
      }

      expect(combined.length).toBeGreaterThan(10);
    },
  );
});
