import { loadEnvConfig } from "@next/env";
import {
  buildAnsibleRolesPlaybook,
  buildPolicyManifestJson,
  buildTerraformModulePack,
  loadPolicyControlsForExport,
} from "../src/lib/policyExportArtifacts";

loadEnvConfig(process.cwd());

const EXPECTED_FRAMEWORKS = 11;

/** Minimum rows per framework after `20260425150000_policy_pack_full_catalog.sql` lands. */
const MIN_CONTROLS_BY_FRAMEWORK: Record<string, number> = {
  NIST: 100,
  ISO27001: 90,
  SOC2: 30,
  CIS: 150,
  PCI_DSS: 50,
  FEDRAMP: 250,
  CMMC: 100,
  HIPAA: 45,
  GDPR: 20,
  CCPA: 10,
  COBIT: 35,
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const all = await loadPolicyControlsForExport();
  assert(all.length > 0, "No policy_framework_controls rows returned (run migrations?)");

  const byFw = new Map<string, number>();
  for (const row of all) {
    byFw.set(row.framework_code, (byFw.get(row.framework_code) ?? 0) + 1);
  }
  assert(byFw.size >= EXPECTED_FRAMEWORKS, `Expected at least ${EXPECTED_FRAMEWORKS} frameworks, got ${byFw.size}`);

  for (const [fw, count] of byFw) {
    const min = MIN_CONTROLS_BY_FRAMEWORK[fw];
    assert(min !== undefined, `Framework ${fw} missing MIN_CONTROLS_BY_FRAMEWORK entry`);
    assert(count >= min, `Framework ${fw} expected at least ${min} controls, got ${count}`);
  }

  const tf = buildTerraformModulePack(all);
  assert(tf.includes("module "), "Terraform export should contain at least one module block");

  const ansible = buildAnsibleRolesPlaybook(all);
  assert(ansible.includes("roles:"), "Ansible export should declare roles");

  const manifestRaw = buildPolicyManifestJson(all);
  const manifest = JSON.parse(manifestRaw) as {
    kind?: string;
    version?: number;
    frameworks?: unknown[];
  };
  assert(manifest.kind === "securewatch360.policy_pack_manifest", "Manifest kind mismatch");
  assert(manifest.version === 1, "Manifest version mismatch");
  assert(Array.isArray(manifest.frameworks), "Manifest frameworks must be an array");

  console.info("[qa-policy-pack] PASS", {
    totalControls: all.length,
    frameworks: byFw.size,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[qa-policy-pack] FAIL:", message);
  process.exit(1);
});
