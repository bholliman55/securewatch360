/**
 * Generate org-facing Markdown policy/procedure stubs from rows in
 * supabase/migrations/20260425150000_policy_pack_full_catalog.sql for a given
 * framework_code (e.g. HIPAA, CMMC, GDPR) or all catalog frameworks.
 *
 * Usage:
 *   node scripts/generate-framework-org-template-stubs.mjs --framework=HIPAA
 *   node scripts/generate-framework-org-template-stubs.mjs --all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const SQL = path.join(
  REPO,
  "supabase",
  "migrations",
  "20260425150000_policy_pack_full_catalog.sql"
);

const KNOWN_FRAMEWORKS = [
  "HIPAA",
  "CMMC",
  "GDPR",
  "CIS",
  "NIST",
  "PCI_DSS",
  "FEDRAMP",
  "SOC2",
  "ISO27001",
  "CCPA",
  "COBIT",
];

function parseArgs() {
  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const fwArg = argv.find((a) => a.startsWith("--framework="));
  const framework = fwArg ? fwArg.split("=")[1]?.trim().toUpperCase() : "";
  return { all, framework };
}

function dirForFramework(frameworkCode) {
  return frameworkCode.toLowerCase();
}

function slugifyControlCode(code) {
  return code.replace(/[().]/g, (c) => ({ "(": "", ")": "", ".": "-" }[c] ?? c));
}

/** Parse a single-quoted SQL literal starting at start; supports '' escapes. */
function parseSqlStringLiteral(line, start) {
  if (line[start] !== "'") return null;
  let i = start + 1;
  let out = "";
  while (i < line.length) {
    if (line[i] === "'" && line[i + 1] === "'") {
      out += "'";
      i += 2;
      continue;
    }
    if (line[i] === "'") {
      return { value: out, next: i + 1 };
    }
    out += line[i];
    i += 1;
  }
  return null;
}

function extractRows(sql, frameworkCode) {
  const needle = `('${frameworkCode}', '`;
  const rows = [];
  const lines = sql.split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(needle);
    if (idx === -1) continue;
    let pos = idx + needle.length;
    const endCode = line.indexOf("', '", pos);
    if (endCode === -1) continue;
    const code = line.slice(pos, endCode);
    const titleOpen = endCode + 3;
    const titleLit = parseSqlStringLiteral(line, titleOpen);
    if (!titleLit) continue;
    const delim = line.indexOf("', '", titleLit.next);
    if (delim === -1) continue;
    const bodyOpen = delim + 3;
    const bodyLit = parseSqlStringLiteral(line, bodyOpen);
    if (!bodyLit) continue;
    rows.push({ code, title: titleLit.value, blurb: bodyLit.value });
  }
  return rows;
}

function writeStub(outDir, frameworkCode, { code, title, blurb }) {
  const slug = slugifyControlCode(code);
  const file = path.join(outDir, `${frameworkCode}-${slug}-ORG-POLICY-STUB.md`);
  const body = `# Organization policy and procedures (stub)

**Framework:** ${frameworkCode} (SecureWatch360 policy pack catalog)  
**Control:** \`${code}\`  
**Summary:** ${title}

## Purpose

Organization-level policy/procedure template aligned to control \`${code}\`. Replace bracketed fields; not legal advice.

## Scope

- **Organization:** [Name]  
- **Systems / data in scope:** [Describe]  
- **Roles:** [List]

## Policy statements

1. [Plain-language implementation of the control for your environment.]
2. [Evidence ownership, tooling (e.g. SecureWatch360), and review cadence.]

## Roles and responsibilities

| Role     | Responsibility |
|----------|------------------|
| [Title]  | [Duty]           |

## Evidence and review

- **Evidence:** [policies, tickets, scans, training, contracts, logs, etc.]
- **Review cadence:** [e.g. annual / on change]
- **Catalog note:** ${blurb}

## Policy-as-code pairing

- Enforceable checks belong in Rego under \`policies/rego/securewatch360/\` (see framework triage stubs and v4 decision bundle).
- Catalog metadata (Terraform/Ansible paths) lives in \`policy_framework_controls\` for this control.

---
*Stub generated from repo migration extract; customize before attestation.*
`;
  fs.writeFileSync(file, body, "utf8");
}

function main() {
  const { all, framework } = parseArgs();
  if (!all && !framework) {
    console.error(
      "Usage: node scripts/generate-framework-org-template-stubs.mjs --framework=HIPAA | --all"
    );
    process.exit(1);
  }
  const sql = fs.readFileSync(SQL, "utf8");
  const targets = all ? KNOWN_FRAMEWORKS : [framework];
  let total = 0;
  for (const fw of targets) {
    if (!KNOWN_FRAMEWORKS.includes(fw)) {
      console.warn(`[skip] Unknown framework code: ${fw}`);
      continue;
    }
    const rows = extractRows(sql, fw);
    if (rows.length === 0) {
      console.warn(`[skip] No rows parsed for ${fw}`);
      continue;
    }
    const outDir = path.join(REPO, "data", "compliance-templates", dirForFramework(fw), "controls");
    fs.mkdirSync(outDir, { recursive: true });
    for (const row of rows) {
      writeStub(outDir, fw, row);
    }
    console.info(`[generate-framework-org-template-stubs] ${fw}: wrote ${rows.length} → ${outDir}`);
    total += rows.length;
  }
  console.info(`[generate-framework-org-template-stubs] Done. Total files written: ${total}`);
}

main();
