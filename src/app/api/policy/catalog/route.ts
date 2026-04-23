import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId")?.trim() ?? "";
    const framework = searchParams.get("framework")?.trim().toUpperCase() ?? "";

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst", "viewer"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    let profilesQuery = supabase
      .from("policy_framework_profiles")
      .select("id, framework_code, framework_name, framework_version, deployment_targets")
      .order("framework_code", { ascending: true });

    if (framework.length > 0) {
      profilesQuery = profilesQuery.eq("framework_code", framework);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;
    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const profileIds = (profiles ?? []).map((p) => p.id as string);
    if (profileIds.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          frameworks: [],
          count: 0,
        },
        { status: 200 }
      );
    }

    const { data: controls, error: controlsError } = await supabase
      .from("policy_framework_controls")
      .select(
        "id, profile_id, control_code, policy_title, policy_body, enforcement_mode, terraform_module, ansible_role"
      )
      .in("profile_id", profileIds)
      .order("control_code", { ascending: true });
    if (controlsError) {
      throw new Error(controlsError.message);
    }

    const controlsByProfile = new Map<string, Array<Record<string, unknown>>>();
    for (const control of controls ?? []) {
      const list = controlsByProfile.get(control.profile_id as string) ?? [];
      list.push({
        id: control.id,
        controlCode: control.control_code,
        policyTitle: control.policy_title,
        policyBody: control.policy_body,
        enforcementMode: control.enforcement_mode,
        terraformModule: control.terraform_module,
        ansibleRole: control.ansible_role,
      });
      controlsByProfile.set(control.profile_id as string, list);
    }

    const frameworks = (profiles ?? []).map((profile) => ({
      id: profile.id,
      frameworkCode: profile.framework_code,
      frameworkName: profile.framework_name,
      frameworkVersion: profile.framework_version,
      deploymentTargets: profile.deployment_targets,
      controls: controlsByProfile.get(profile.id as string) ?? [],
    }));

    return NextResponse.json(
      {
        ok: true,
        frameworks,
        count: frameworks.length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to load policy catalog", message },
      { status: 500 }
    );
  }
}
