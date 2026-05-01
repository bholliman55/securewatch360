import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FRAMEWORKS = ["hipaa", "cmmc", "gdpr", "cis", "nist"] as const;
const root = path.join(process.cwd(), "data", "compliance-templates");

describe("compliance template inventory (FRAMEWORK-ROADMAP first wave)", () => {
  for (const fw of FRAMEWORKS) {
    it(`${fw} has control stubs on disk`, () => {
      const dir = path.join(root, fw, "controls");
      expect(fs.existsSync(dir), `${dir} missing`).toBe(true);
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      expect(files.length).toBeGreaterThan(4);
    });
  }
});
