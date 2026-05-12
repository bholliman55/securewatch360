import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  loadScenarioDefinitionsFromDirectory,
  loadScenarioDefinitionFile,
} from "../engines/simulationRunner";

describe("Scenario loading from disk", () => {
  const bundledDir = path.join(__dirname, "../scenarios");

  it("loads all bundled scenario fixtures without errors", async () => {
    const defs = await loadScenarioDefinitionsFromDirectory(bundledDir);
    expect(defs.length).toBeGreaterThan(0);
    const ids = new Set(defs.map((d) => d.id));
    expect(ids.has("lab-phish-001")).toBe(true);
    expect(ids.has("golden-msp-rdp-remediated")).toBe(true);
    expect(ids.has("golden-ransomware-isolated-incident-report")).toBe(true);
  });

  it("loads scenarios from an isolated temporary directory copy", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sw360-scen-"));
    const srcFile = path.join(__dirname, "fixtures/mock-minimal-local.json");
    const destFile = path.join(tmp, "mock-minimal-local.json");
    await fs.copyFile(srcFile, destFile);
    try {
      const defs = await loadScenarioDefinitionsFromDirectory(tmp);
      expect(defs.length).toBe(1);
      expect(defs[0]!.id).toBe("mock-lab-min-local-001");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("loads a single file path via loadScenarioDefinitionFile", async () => {
    const filePath = path.join(__dirname, "fixtures/mock-minimal-local.json");
    const def = await loadScenarioDefinitionFile(filePath);
    expect(def.target_type).toBe("user_identity");
  });

  it("round-trips phishing fixture via path-based loader", async () => {
    const def = await loadScenarioDefinitionFile(path.join(bundledDir, "phishing_email_clicked.json"));
    expect(def.id).toBe("lab-phish-001");
  });
});
