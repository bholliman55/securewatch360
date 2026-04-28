/**
 * Extracts HIPAA Security Rule control rows from the policy pack migration SQL
 * and writes one org-facing Markdown stub per control under
 * data/compliance-templates/hipaa/controls/
 *
 * Run: node scripts/generate-hipaa-org-template-stubs.mjs
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
const OUT_DIR = path.join(REPO, "data", "compliance-templates", "hipaa", "controls");

function slugifyControlCode(code) {
  return code.replace(/[().]/g, (c) => ({ "(": "", ")": "", ".": "-" }[c] ?? c));
}

function main() {
  const sql = fs.readFileSync(SQL, "utf8");
  const re = /\('HIPAA', '([^']+)', '([^']*)', '([^']*)',/g;
  const rows = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    rows.push({ code: m[1], title: m[2], blurb: m[3] });
  }
  if (rows.length === 0) {
    throw new Error("No HIPAA rows found — check migration file path and SQL format.");
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const { code, title, blurb } of rows) {
    const file = path.join(OUT_DIR, `HIPAA-${slugifyControlCode(code)}-ORG-POLICY-STUB.md`);
    const body = `# Organization policy and procedures (stub)

**Framework:** HIPAA Security Rule (45 CFR Part 164 Subpart C)  
**Control:** \`${code}\`  
**Summary:** ${title}

## Purpose

This document is an organization-level policy/procedure **template** aligned to control \`${code}\`.  
Customize all bracketed fields for your entity. This is not legal advice.

## Scope

- **Covered entity / business associate:** [Organization name]  
- **Systems in scope:** [e.g., systems that create, receive, maintain, or transmit ePHI]  
- **Workforce / roles:** [List]

## Policy statements

1. [Describe how the organization implements the requirement in plain language.]
2. [Reference technical and administrative measures; align evidence collection in SecureWatch360.]

## Roles and responsibilities

| Role        | Responsibility |
|------------|----------------|
| [Title]    | [Duty]         |

## Evidence and review

- **Evidence types:** [policies, training records, access reviews, tickets, scan exports, BAA, etc.]
- **Review cadence:** [e.g., annual / upon material change]
- **Catalog note:** ${blurb}

## Rego (policy-as-code) pairing

- Machine-enforceable rules for SecureWatch decisioning live under \`policies/rego/securewatch360/hipaa_*.rego\`.
- Map this control to the policy catalog entry with the same control code in \`policy_framework_controls\`.

---
*Stub generated for onboarding; fill before relying on for compliance attestation.*
`;
    fs.writeFileSync(file, body, "utf8");
  }
  console.info(`[generate-hipaa-org-template-stubs] Wrote ${rows.length} files to ${OUT_DIR}`);
}

main();
