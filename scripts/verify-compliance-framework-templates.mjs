#!/usr/bin/env node
/**
 * CI helper: ensure priority framework template directories exist with stub controls.
 * Aligns with docs/compliance/FRAMEWORK-ROADMAP.md (HIPAA → CMMC → GDPR → CIS → NIST).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "data", "compliance-templates");
const frameworks = ["hipaa", "cmmc", "gdpr", "cis", "nist"];
const minControls = 5;

let failed = false;
for (const fw of frameworks) {
  const controlsDir = path.join(root, fw, "controls");
  if (!fs.existsSync(controlsDir)) {
    console.error(`Missing controls dir: ${controlsDir}`);
    failed = true;
    continue;
  }
  const files = fs.readdirSync(controlsDir).filter((f) => f.endsWith(".md"));
  if (files.length < minControls) {
    console.error(`Expected at least ${minControls} *.md in ${controlsDir}, found ${files.length}`);
    failed = true;
  } else {
    console.log(`OK ${fw}: ${files.length} control stubs`);
  }
}

if (failed) process.exit(1);
