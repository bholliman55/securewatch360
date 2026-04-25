import type { SupabaseClient } from "@supabase/supabase-js";

type ControlRequirementRow = {
  id: string;
  control_code: string;
  title: string;
  framework_id: string;
  framework: {
    framework_code: string;
    framework_name: string;
  } | null;
};

type MappingRow = {
  control_requirement_id: string;
  finding_id: string;
  finding: { status: string } | { status: string }[] | null;
};

export type CompliancePostureControlRow = {
  controlRequirementId: string;
  frameworkCode: string;
  frameworkName: string;
  controlCode: string;
  controlTitle: string;
  mappedFindings: number;
  failingFindings: number;
  status: "pass" | "fail";
};

export type CompliancePostureSummary = {
  totalControls: number;
  controlsPass: number;
  controlsFail: number;
  openMappingLinks: number;
  distinctOpenMappedFindings: number;
  totalMappingLinks: number;
};

function extractFindingStatus(finding: MappingRow["finding"]): string | null {
  if (!finding) return null;
  if (Array.isArray(finding)) return finding[0]?.status ?? null;
  return finding.status ?? null;
}

function isOpenFindingStatus(status: string | null): boolean {
  if (!status) return false;
  return status !== "resolved" && status !== "risk_accepted";
}

/**
 * Aggregates control coverage and open findings for a tenant, optionally scoped to one framework.
 * @param frameworkCode uppercase framework code (e.g. SOC2), or "" for all frameworks.
 */
export async function computeCompliancePosture(
  supabase: SupabaseClient,
  tenantId: string,
  frameworkCode: string
): Promise<{
  framework: string | null;
  controls: CompliancePostureControlRow[];
  summary: CompliancePostureSummary;
}> {
  const frameworkUpper = frameworkCode.trim().toUpperCase();

  let frameworkIdFilter: string | null = null;
  if (frameworkUpper.length > 0) {
    const { data: framework, error: frameworkError } = await supabase
      .from("control_frameworks")
      .select("id")
      .eq("framework_code", frameworkUpper)
      .single();

    if (frameworkError || !framework) {
      throw new Error("FRAMEWORK_NOT_FOUND");
    }
    frameworkIdFilter = framework.id;
  }

  let controlsQuery = supabase
    .from("control_requirements")
    .select(
      "id, control_code, title, framework_id, framework:control_frameworks(framework_code, framework_name)"
    )
    .order("control_code", { ascending: true });

  if (frameworkIdFilter) {
    controlsQuery = controlsQuery.eq("framework_id", frameworkIdFilter);
  }

  const { data: controlsData, error: controlsError } = await controlsQuery;
  if (controlsError) {
    throw new Error(controlsError.message);
  }

  const controls = (controlsData ?? []) as unknown as ControlRequirementRow[];
  const controlIds = new Set(controls.map((c) => c.id));

  const { data: mappingsData, error: mappingsError } = await supabase
    .from("finding_control_mappings")
    .select("control_requirement_id, finding_id, finding:findings(status)")
    .eq("tenant_id", tenantId);

  if (mappingsError) {
    throw new Error(mappingsError.message);
  }

  const mappings = (mappingsData ?? []) as unknown as MappingRow[];
  const openByControl = new Map<string, number>();
  const totalByControl = new Map<string, number>();
  const distinctOpenFindingIds = new Set<string>();

  for (const mapping of mappings) {
    if (!controlIds.has(mapping.control_requirement_id)) continue;

    const status = extractFindingStatus(mapping.finding);
    totalByControl.set(
      mapping.control_requirement_id,
      (totalByControl.get(mapping.control_requirement_id) ?? 0) + 1
    );
    if (isOpenFindingStatus(status)) {
      openByControl.set(
        mapping.control_requirement_id,
        (openByControl.get(mapping.control_requirement_id) ?? 0) + 1
      );
      distinctOpenFindingIds.add(mapping.finding_id);
    }
  }

  const controlRows: CompliancePostureControlRow[] = controls.map((control) => {
    const failingFindings = openByControl.get(control.id) ?? 0;
    const mappedFindings = totalByControl.get(control.id) ?? 0;

    return {
      controlRequirementId: control.id,
      frameworkCode: control.framework?.framework_code ?? "UNKNOWN",
      frameworkName: control.framework?.framework_name ?? "Unknown Framework",
      controlCode: control.control_code,
      controlTitle: control.title,
      mappedFindings,
      failingFindings,
      status: failingFindings > 0 ? "fail" : "pass",
    };
  });

  const controlsFail = controlRows.filter((c) => c.status === "fail").length;
  const totalControls = controlRows.length;
  const controlsPass = totalControls - controlsFail;
  const openMappingLinks = controlRows.reduce((acc, c) => acc + c.failingFindings, 0);
  const totalMappingLinks = controlRows.reduce((acc, c) => acc + c.mappedFindings, 0);

  return {
    framework: frameworkUpper.length > 0 ? frameworkUpper : null,
    controls: controlRows,
    summary: {
      totalControls,
      controlsPass,
      controlsFail,
      openMappingLinks,
      distinctOpenMappedFindings: distinctOpenFindingIds.size,
      totalMappingLinks,
    },
  };
}

export function frameworkParamToSnapshotKey(frameworkParam: string): string {
  const u = frameworkParam.trim().toUpperCase();
  return u.length > 0 ? u : "__ALL__";
}

export async function upsertCompliancePostureSnapshot(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    frameworkCodeKey: string;
    snapshotDate: string;
    summary: CompliancePostureSummary;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("tenant_compliance_posture").upsert(
    {
      tenant_id: args.tenantId,
      framework_code: args.frameworkCodeKey,
      snapshot_date: args.snapshotDate,
      computed_at: now,
      total_controls: args.summary.totalControls,
      controls_pass: args.summary.controlsPass,
      controls_fail: args.summary.controlsFail,
      open_mapping_links: args.summary.openMappingLinks,
      distinct_open_mapped_findings: args.summary.distinctOpenMappedFindings,
      total_mapping_links: args.summary.totalMappingLinks,
      detail: args.detail ?? {},
    },
    { onConflict: "tenant_id,framework_code,snapshot_date" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
