import { getSupabaseAdminClient } from "@/lib/supabase";

export type PolicyControlRow = {
  framework_code: string;
  control_code: string;
  policy_title: string;
  policy_body: string;
  enforcement_mode: string;
  terraform_module: string | null;
  ansible_role: string | null;
};

/**
 * Loads catalog controls for IaC export (global catalog; not tenant-specific rows).
 */
export async function loadPolicyControlsForExport(frameworkCodeUpper?: string): Promise<PolicyControlRow[]> {
  const supabase = getSupabaseAdminClient();

  let profilesQuery = supabase
    .from("policy_framework_profiles")
    .select("id, framework_code")
    .order("framework_code", { ascending: true });

  if (frameworkCodeUpper && frameworkCodeUpper.length > 0) {
    profilesQuery = profilesQuery.eq("framework_code", frameworkCodeUpper);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError) throw new Error(profilesError.message);

  const profileIds = (profiles ?? []).map((p) => p.id as string);
  const frameworkByProfileId = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id as string, p.framework_code as string])
  );
  if (profileIds.length === 0) return [];

  const { data: controls, error: controlsError } = await supabase
    .from("policy_framework_controls")
    .select(
      "profile_id, control_code, policy_title, policy_body, enforcement_mode, terraform_module, ansible_role"
    )
    .in("profile_id", profileIds)
    .order("control_code", { ascending: true });

  if (controlsError) throw new Error(controlsError.message);

  return (controls ?? []).map((row) => {
    const profileId = row.profile_id as string;
    return {
      framework_code: frameworkByProfileId.get(profileId) ?? "UNKNOWN",
      control_code: row.control_code as string,
      policy_title: row.policy_title as string,
      policy_body: row.policy_body as string,
      enforcement_mode: row.enforcement_mode as string,
      terraform_module: (row.terraform_module as string | null) ?? null,
      ansible_role: (row.ansible_role as string | null) ?? null,
    };
  });
}

export function buildTerraformModulePack(controls: PolicyControlRow[]): string {
  const lines: string[] = [
    "# SecureWatch360 — policy pack (Terraform)",
    "# Generated from policy_framework_controls. Adjust module sources for your registry/layout.",
    "",
  ];
  for (const c of controls) {
    if (!c.terraform_module?.trim()) continue;
    const safeId = `${c.framework_code}_${c.control_code}`.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`module "${safeId}" {`);
    lines.push(`  source = "${c.terraform_module.trim()}"`);
    lines.push(`  # ${c.framework_code} ${c.control_code}: ${c.policy_title}`);
    lines.push(`  # enforcement: ${c.enforcement_mode}`);
    lines.push(`}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildAnsibleRolesPlaybook(controls: PolicyControlRow[]): string {
  const roles = controls
    .map((c) => c.ansible_role?.trim())
    .filter((r): r is string => Boolean(r));
  const unique = Array.from(new Set(roles));

  const lines: string[] = [
    "---",
    "# SecureWatch360 — policy pack (Ansible)",
    "# Generated from policy_framework_controls. Map roles to your collections/galaxy names.",
    "- name: Apply SecureWatch360 policy controls",
    "  hosts: all",
    "  gather_facts: true",
    "  roles:",
  ];
  for (const role of unique) {
    lines.push(`    - role: ${role}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function buildPolicyManifestJson(controls: PolicyControlRow[]): string {
  const byFramework = new Map<string, PolicyControlRow[]>();
  for (const c of controls) {
    const list = byFramework.get(c.framework_code) ?? [];
    list.push(c);
    byFramework.set(c.framework_code, list);
  }

  const frameworks = Array.from(byFramework.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([frameworkCode, rows]) => ({
      frameworkCode,
      controlCount: rows.length,
      controls: rows.map((r) => ({
        controlCode: r.control_code,
        title: r.policy_title,
        body: r.policy_body,
        enforcementMode: r.enforcement_mode,
        terraformModule: r.terraform_module,
        ansibleRole: r.ansible_role,
      })),
    }));

  return JSON.stringify(
    {
      kind: "securewatch360.policy_pack_manifest",
      version: 1,
      generatedAt: new Date().toISOString(),
      frameworks,
    },
    null,
    2
  );
}
