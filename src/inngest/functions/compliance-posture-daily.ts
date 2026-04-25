import { inngest } from "@/inngest/client";
import {
  computeCompliancePosture,
  frameworkParamToSnapshotKey,
  upsertCompliancePostureSnapshot,
} from "@/lib/compliancePosture";
import { getSupabaseAdminClient } from "@/lib/supabase";

/**
 * Daily UTC: snapshot posture per tenant for each framework plus an __ALL__ rollup.
 */
export const compliancePostureDaily = inngest.createFunction(
  { id: "compliance-posture-daily", retries: 1 },
  { cron: "0 7 * * *" },
  async () => {
    const supabase = getSupabaseAdminClient();
    const snapshotDate = new Date().toISOString().slice(0, 10);

    const { data: tenants, error: tenantError } = await supabase.from("tenants").select("id");
    if (tenantError) {
      throw new Error(tenantError.message);
    }

    const { data: frameworks, error: fwError } = await supabase
      .from("control_frameworks")
      .select("framework_code");
    if (fwError) {
      throw new Error(fwError.message);
    }

    const codes = (frameworks ?? [])
      .map((f) => (typeof f.framework_code === "string" ? f.framework_code.toUpperCase() : ""))
      .filter((c) => c.length > 0);

    const targets: { tenantId: string; frameworkParam: string; key: string }[] = [];
    for (const t of tenants ?? []) {
      const tenantId = t.id;
      if (!tenantId) continue;
      targets.push({ tenantId, frameworkParam: "", key: frameworkParamToSnapshotKey("") });
      for (const code of codes) {
        targets.push({ tenantId, frameworkParam: code, key: frameworkParamToSnapshotKey(code) });
      }
    }

    let upserts = 0;
    for (const target of targets) {
      const { summary, controls } = await computeCompliancePosture(
        supabase,
        target.tenantId,
        target.frameworkParam
      );
      await upsertCompliancePostureSnapshot(supabase, {
        tenantId: target.tenantId,
        frameworkCodeKey: target.key,
        snapshotDate,
        summary,
        detail: { controlRowCount: controls.length },
      });
      upserts += 1;
    }

    return { ok: true, snapshotDate, upserts, tenantCount: tenants?.length ?? 0 };
  }
);
