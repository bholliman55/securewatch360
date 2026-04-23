/**
 * Generates supabase/migrations/*_policy_pack_full_catalog.sql from data/policy-catalog/*.json
 * plus deterministic CIS / SOC2 / PCI / GDPR / CCPA / COBIT / HIPAA rows.
 *
 * Run from repo root: node scripts/generate-policy-pack-full-sql.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data", "policy-catalog");
const OUT = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260425150000_policy_pack_full_catalog.sql",
);

function readJson(rel) {
  const p = path.join(DATA, rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function pathsFor(frameworkCode, controlCode) {
  const slug = `${frameworkCode}_${controlCode}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return {
    tf: `modules/policies/${slug}`,
    ansible: `roles/policy_${slug}`,
  };
}

function defaultBody(frameworkName, controlCode) {
  return sqlEscape(
    `Catalog control ${controlCode}. Map evidence collection, ownership, and automation to organizational policy. Framework: ${frameworkName}.`,
  );
}

/** CIS Controls v8 safeguard counts per control (1–18); total = 153 */
const CIS_SAFEGUARDS_PER_CONTROL = [6, 5, 14, 12, 5, 8, 13, 7, 7, 4, 5, 5, 11, 9, 6, 11, 13, 12];

function cisControls() {
  if (CIS_SAFEGUARDS_PER_CONTROL.reduce((a, b) => a + b, 0) !== 153) {
    throw new Error("CIS_SAFEGUARDS_PER_CONTROL must sum to 153");
  }
  const out = [];
  for (let c = 1; c <= 18; c++) {
    const n = CIS_SAFEGUARDS_PER_CONTROL[c - 1];
    for (let i = 1; i <= n; i++) {
      const id = `${c}.${i}`;
      out.push({
        id,
        title: `CIS Controls v8 Safeguard ${id}`,
      });
    }
  }
  return out;
}

/** AICPA TSC 2017 Security — Common Criteria points (CC1–CC9) */
function soc2Controls() {
  const blocks = [
    ["CC1", 5, "Control environment"],
    ["CC2", 3, "Communication and information"],
    ["CC3", 4, "Risk assessment"],
    ["CC4", 2, "Monitoring activities"],
    ["CC5", 3, "Control activities"],
    ["CC6", 8, "Logical and physical access"],
    ["CC7", 5, "System operations"],
    ["CC8", 1, "Change management"],
    ["CC9", 2, "Risk mitigation"],
  ];
  const out = [];
  for (const [fam, count, theme] of blocks) {
    for (let i = 1; i <= count; i++) {
      const id = `${fam}.${i}`;
      out.push({
        id,
        title: `SOC 2 (TSC Security) — ${fam}.${i} (${theme})`,
      });
    }
  }
  return out;
}

/** PCI DSS v4.x style numbered requirements (representative catalog for policy mapping; refine titles locally). */
function pciControls() {
  const parts = [
    [1, 5],
    [2, 4],
    [3, 6],
    [4, 5],
    [5, 4],
    [6, 4],
    [7, 7],
    [8, 6],
    [9, 3],
    [10, 5],
    [11, 4],
    [12, 5],
  ];
  const out = [];
  for (const [req, n] of parts) {
    for (let i = 1; i <= n; i++) {
      const id = `${req}.${i}`;
      out.push({
        id,
        title: `PCI DSS v4 — Requirement ${id} (define testing procedures per PCI SSC standard)`,
      });
    }
  }
  return out;
}

function gdprControls() {
  const rows = [
    [5, "Principles relating to processing of personal data"],
    [6, "Lawfulness of processing"],
    [7, "Conditions for consent"],
    [9, "Processing of special categories"],
    [12, "Transparent information and communication"],
    [13, "Information to be provided when collected from the data subject"],
    [14, "Information to be provided when not obtained from the data subject"],
    [15, "Right of access by the data subject"],
    [16, "Right to rectification"],
    [17, "Right to erasure ('right to be forgotten')"],
    [18, "Right to restriction of processing"],
    [20, "Right to data portability"],
    [21, "Right to object"],
    [25, "Data protection by design and by default"],
    [28, "Processor obligations"],
    [30, "Records of processing activities"],
    [32, "Security of processing"],
    [33, "Notification of a personal data breach to the supervisory authority"],
    [35, "Data protection impact assessment"],
    [37, "Designation of the data protection officer"],
    [44, "General principle for transfers"],
    [45, "Transfers on the basis of an adequacy decision"],
    [46, "Transfers subject to appropriate safeguards"],
    [47, "Binding corporate rules"],
    [48, "Transfers not authorized by Union law"],
    [49, "Derogations for specific situations"],
  ];
  return rows.map(([art, title]) => ({ id: `Art_${art}`, title: `GDPR Article ${art} — ${title}` }));
}

function ccpaControls() {
  const rows = [
    ["1798.100", "Consumer right to know categories and specific pieces of PI"],
    ["1798.105", "Consumer right to delete"],
    ["1798.110", "Business disclosure obligations (categories)"],
    ["1798.115", "Business disclosure obligations (specific pieces)"],
    ["1798.120", "Consumer right to opt-out of sale/sharing"],
    ["1798.121", "Consumer right to limit use of sensitive PI"],
    ["1798.125", "Non-discrimination"],
    ["1798.130", "Notice at collection"],
    ["1798.135", "Authorized agent requests"],
    ["1798.140", "Definitions"],
    ["1798.145", "Exemptions"],
    ["1798.150", "Reasonable security procedures and practices"],
    ["1798.185", "Enforcement"],
    ["1798.192", "Civil actions"],
    ["1798.198", "Violations involving minors"],
  ];
  return rows.map(([id, title]) => ({ id, title: `CCPA ${id} — ${title}` }));
}

function cobitControls() {
  const practices = [
    ["EDM01", "Governance framework setting and maintenance"],
    ["EDM02", "Benefits delivery"],
    ["EDM03", "Risk optimization"],
    ["EDM04", "Resource optimization"],
    ["EDM05", "Stakeholder engagement"],
    ["APO01", "Managed I&T management framework"],
    ["APO02", "Managed strategy"],
    ["APO03", "Managed enterprise architecture"],
    ["APO04", "Managed innovation"],
    ["APO05", "Managed portfolio"],
    ["APO06", "Managed budget and costs"],
    ["APO07", "Managed people"],
    ["APO08", "Managed relationships"],
    ["APO09", "Managed service agreements"],
    ["APO10", "Managed vendors"],
    ["APO11", "Managed quality"],
    ["APO12", "Managed risk"],
    ["APO13", "Managed security"],
    ["APO14", "Managed data"],
    ["BAI01", "Managed programs"],
    ["BAI02", "Managed requirements definition"],
    ["BAI03", "Managed solutions identification and build"],
    ["BAI04", "Managed availability and capacity"],
    ["BAI05", "Managed organizational change"],
    ["BAI06", "Managed IT changes"],
    ["BAI07", "Managed IT acceptance and transitioning"],
    ["BAI08", "Managed knowledge"],
    ["BAI09", "Managed assets"],
    ["BAI10", "Managed configuration"],
    ["BAI11", "Managed projects"],
    ["DSS01", "Managed operations"],
    ["DSS02", "Managed service requests and incidents"],
    ["DSS03", "Managed problems"],
    ["DSS04", "Managed continuity"],
    ["DSS05", "Managed security services"],
    ["DSS06", "Managed business process controls"],
    ["MEA01", "Managed performance and conformance monitoring"],
    ["MEA02", "Managed system of internal control"],
    ["MEA03", "Managed compliance with external requirements"],
    ["MEA04", "Managed assurance"],
  ];
  return practices.map(([id, title]) => ({ id, title: `COBIT 2019 — ${id} ${title}` }));
}

function hipaaControls() {
  const rows = [
    ["164.308(a)(1)", "Security management process — policies and procedures"],
    ["164.308(a)(1)(ii)(A)", "Risk analysis"],
    ["164.308(a)(1)(ii)(B)", "Risk management"],
    ["164.308(a)(1)(ii)(C)", "Sanction policy"],
    ["164.308(a)(1)(ii)(D)", "Information system activity review"],
    ["164.308(a)(2)", "Assigned security responsibility"],
    ["164.308(a)(3)", "Workforce security"],
    ["164.308(a)(3)(ii)(A)", "Authorization/supervision"],
    ["164.308(a)(3)(ii)(B)", "Workforce clearance procedure"],
    ["164.308(a)(3)(ii)(C)", "Termination procedures"],
    ["164.308(a)(4)", "Information access management"],
    ["164.308(a)(4)(ii)(A)", "Isolating health care clearinghouse functions"],
    ["164.308(a)(4)(ii)(B)", "Access authorization"],
    ["164.308(a)(4)(ii)(C)", "Access establishment and modification"],
    ["164.308(a)(5)", "Security awareness and training"],
    ["164.308(a)(5)(ii)(A)", "Security reminders"],
    ["164.308(a)(5)(ii)(B)", "Protection from malicious software"],
    ["164.308(a)(5)(ii)(C)", "Log-in monitoring"],
    ["164.308(a)(5)(ii)(D)", "Password management"],
    ["164.308(a)(6)", "Security incident procedures"],
    ["164.308(a)(7)", "Contingency plan"],
    ["164.308(a)(7)(ii)(A)", "Data backup plan"],
    ["164.308(a)(7)(ii)(B)", "Disaster recovery plan"],
    ["164.308(a)(7)(ii)(C)", "Emergency mode operation plan"],
    ["164.308(a)(7)(ii)(D)", "Testing and revision procedures"],
    ["164.308(a)(7)(ii)(E)", "Applications and data criticality analysis"],
    ["164.308(a)(8)", "Evaluation"],
    ["164.308(b)(1)", "Business associate contracts and other arrangements"],
    ["164.310(a)(1)", "Facility access controls"],
    ["164.310(a)(2)(i)", "Contingency operations"],
    ["164.310(a)(2)(ii)", "Facility security plan"],
    ["164.310(a)(2)(iii)", "Access control and validation procedures"],
    ["164.310(a)(2)(iv)", "Maintenance records"],
    ["164.310(b)", "Workstation use"],
    ["164.310(c)", "Workstation security"],
    ["164.310(d)(1)", "Device and media controls — disposal"],
    ["164.310(d)(2)(i)", "Media re-use"],
    ["164.310(d)(2)(ii)", "Accountability"],
    ["164.310(d)(2)(iii)", "Data backup and storage"],
    ["164.312(a)(1)", "Access control — unique user identification"],
    ["164.312(a)(2)(i)", "Emergency access procedure"],
    ["164.312(a)(2)(ii)", "Automatic logoff"],
    ["164.312(a)(2)(iii)", "Encryption and decryption"],
    ["164.312(b)", "Audit controls"],
    ["164.312(c)(1)", "Integrity"],
    ["164.312(c)(2)", "Mechanism to authenticate ePHI"],
    ["164.312(d)", "Person or entity authentication"],
    ["164.312(e)(1)", "Transmission security"],
    ["164.312(e)(2)(i)", "Integrity controls"],
    ["164.312(e)(2)(ii)", "Encryption"],
    ["164.316(a)", "Policies and procedures"],
    ["164.316(b)(1)", "Documentation — time limit"],
    ["164.316(b)(2)(i)", "Availability"],
    ["164.316(b)(2)(ii)", "Updates"],
  ];
  return rows.map(([id, title]) => ({ id, title: `HIPAA Security Rule ${id} — ${title}` }));
}

function emitBlock(lines, frameworkCode, frameworkName, controls) {
  lines.push(`-- ${frameworkCode}: ${controls.length} controls`);
  lines.push(`DELETE FROM public.policy_framework_controls c`);
  lines.push(`USING public.policy_framework_profiles p`);
  lines.push(`WHERE c.profile_id = p.id AND p.framework_code = '${frameworkCode}';`);
  lines.push("");
  lines.push(`INSERT INTO public.policy_framework_controls (`);
  lines.push(`  profile_id, control_code, policy_title, policy_body, enforcement_mode, terraform_module, ansible_role`);
  lines.push(`)`);
  lines.push(`SELECT p.id, v.control_code, v.policy_title, v.policy_body, v.enforcement_mode, v.terraform_module, v.ansible_role`);
  lines.push(`FROM public.policy_framework_profiles p`);
  lines.push(`JOIN (`);
  const valueRows = controls.map((row) => {
    const code = row.id ?? row.control_code;
    const title = row.title ?? row.policy_title;
    const { tf, ansible } = pathsFor(frameworkCode, code);
    const body = defaultBody(frameworkName, code);
    return `    ('${frameworkCode}', '${sqlEscape(code)}', '${sqlEscape(title)}', '${body}', 'advisory', '${sqlEscape(
      tf,
    )}', '${sqlEscape(ansible)}')`;
  });
  lines.push(`  VALUES`);
  lines.push(valueRows.join(",\n"));
  lines.push(`) AS v(framework_code, control_code, policy_title, policy_body, enforcement_mode, terraform_module, ansible_role)`);
  lines.push(`  ON v.framework_code = p.framework_code;`);
  lines.push("");
}

function main() {
  const nist = readJson("nist-csf-2.0-core.json");
  const iso = readJson("iso27001-2022-annex-a.json");
  const fed = readJson("nist-sp800-53-rev5-moderate.json");
  const n171 = readJson("nist-sp800-171-rev3-requirements.json");

  const lines = [];
  lines.push(`-- SecureWatch360: full policy_framework_controls catalogs (policy-as-code source rows)`);
  lines.push(`-- Generated by scripts/generate-policy-pack-full-sql.mjs — do not hand-edit; regenerate after changing data/policy-catalog.`);
  lines.push(`BEGIN;`);
  lines.push("");

  emitBlock(
    lines,
    "NIST",
    "NIST Cybersecurity Framework 2.0",
    nist.controls.map((c) => ({ id: c.id, title: c.title })),
  );
  emitBlock(lines, "ISO27001", "ISO/IEC 27001:2022", iso.controls.map((c) => ({ id: c.id, title: c.title })));
  emitBlock(lines, "SOC2", "SOC 2 (TSC Security)", soc2Controls());
  emitBlock(lines, "CIS", "CIS Controls v8", cisControls());
  emitBlock(lines, "PCI_DSS", "PCI DSS v4", pciControls());
  emitBlock(
    lines,
    "FEDRAMP",
    "NIST SP 800-53 Rev5 MODERATE baseline (FedRAMP-aligned catalog)",
    fed.controls.map((c) => ({ id: c.id, title: c.title })),
  );
  emitBlock(
    lines,
    "CMMC",
    "NIST SP 800-171 Rev3 security requirements (CMMC L2 technical practice catalog)",
    n171.controls.map((c) => ({ id: c.id, title: c.title })),
  );
  emitBlock(lines, "HIPAA", "HIPAA Security Rule (45 CFR Part 164 Subpart C)", hipaaControls());
  emitBlock(lines, "GDPR", "EU GDPR (2016/679) — selected articles for operational mapping", gdprControls());
  emitBlock(lines, "CCPA", "California Consumer Privacy Act — selected Civil Code sections", ccpaControls());
  emitBlock(lines, "COBIT", "COBIT 2019 — core management practices (sample governance catalog)", cobitControls());

  lines.push(`COMMIT;`);
  lines.push("");

  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log("wrote", OUT);
  console.log(
    "row counts:",
    JSON.stringify(
      {
        NIST: nist.controls.length,
        ISO27001: iso.controls.length,
        SOC2: soc2Controls().length,
        CIS: cisControls().length,
        PCI_DSS: pciControls().length,
        FEDRAMP: fed.controls.length,
        CMMC: n171.controls.length,
        HIPAA: hipaaControls().length,
        GDPR: gdprControls().length,
        CCPA: ccpaControls().length,
        COBIT: cobitControls().length,
      },
      null,
      2,
    ),
  );
}

main();
