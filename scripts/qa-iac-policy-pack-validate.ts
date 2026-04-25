import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const REPO = process.cwd();
const TF_DIR = path.join(REPO, "iac", "securewatch360-policy-pack", "terraform");
const ANS_DIR = path.join(REPO, "iac", "securewatch360-policy-pack", "ansible");

function canRunTerraform(): boolean {
  return spawnSync("terraform", ["version"], { stdio: "ignore" }).status === 0;
}

function canRunAnsible(): boolean {
  return spawnSync("ansible-playbook", ["--version"], { stdio: "ignore" }).status === 0;
}

function main() {
  const requireBinaries = process.env.CI === "true" || process.env.REQUIRE_TERRAFORM_ANSIBLE === "1";
  let ranTerraform = false;
  let ranAnsible = false;

  if (!canRunTerraform()) {
    if (requireBinaries) {
      throw new Error("terraform is required in CI; install Terraform 1.5+ and re-run");
    }
    console.warn("[qa-iac] terraform not on PATH; skipping Terraform validate (set CI=1 to fail if missing)");
  } else {
    const init = spawnSync("terraform", ["init", "-backend=false", "-input=false"], { cwd: TF_DIR, stdio: "inherit" });
    if (init.status !== 0) {
      throw new Error("[qa-iac] terraform init failed");
    }
    const v = spawnSync("terraform", ["validate"], { cwd: TF_DIR, stdio: "inherit" });
    if (v.status !== 0) {
      throw new Error("[qa-iac] terraform validate failed");
    }
    ranTerraform = true;
  }

  if (!canRunAnsible()) {
    if (requireBinaries) {
      throw new Error("ansible-playbook is required in CI; install Ansible and re-run");
    }
    console.warn("[qa-iac] ansible-playbook not on PATH; skipping syntax check");
  } else {
    const r = spawnSync(
      "ansible-playbook",
      ["-i", "localhost,", "-c", "local", "playbook-securewatch360-policy-pack.yml", "--syntax-check"],
      { cwd: ANS_DIR, stdio: "inherit", env: { ...process.env, ANSIBLE_CONFIG: path.join(ANS_DIR, "ansible.cfg") } }
    );
    if (r.status !== 0) {
      throw new Error("[qa-iac] ansible-playbook --syntax-check failed");
    }
    ranAnsible = true;
  }

  if (!ranTerraform && !ranAnsible) {
    console.warn(
      "[qa-iac] DONE (no checks ran — install Terraform and/or Ansible, or run in CI with binaries on PATH)"
    );
    return;
  }

  console.info("[qa-iac] PASS — reference Terraform modules and/or Ansible roles validated");
}

try {
  main();
} catch (e: unknown) {
  console.error("[qa-iac] FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
}
