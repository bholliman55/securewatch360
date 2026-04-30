import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const FRAMEWORKS = ["NIST", "HIPAA", "PCI-DSS", "ISO 27001", "SOC 2", "CMMC", "CIS", "GDPR", "FedRAMP", "CCPA", "COBIT"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users").select("tenant_id").eq("user_id", user.id).single();
  if (!tenantUser?.tenant_id) return NextResponse.json({ error: "Tenant not found" }, { status: 403 });

  const tenantId = tenantUser.tenant_id as string;

  const { data: postureRows } = await supabase
    .from("tenant_compliance_posture")
    .select("framework, controls, computed_at")
    .eq("tenant_id", tenantId);

  const postureByFramework = new Map(
    (postureRows ?? []).map((r) => [r.framework as string, r])
  );

  const matrix = FRAMEWORKS.map((fw) => {
    const row = postureByFramework.get(fw);
    if (!row) return { framework: fw, passing: 0, failing: 0, notApplicable: 0, total: 0, score: null as number | null, hasData: false };
    const ctrl = (row.controls ?? {}) as Record<string, number>;
    const passing = ctrl.passing ?? 0;
    const failing = ctrl.failing ?? 0;
    const notApplicable = ctrl.not_applicable ?? 0;
    const total = passing + failing + notApplicable;
    const score = total > 0 ? Math.round((passing / (passing + failing)) * 100) : null;
    return { framework: fw, passing, failing, notApplicable, total, score, hasData: true };
  });

  // Controls failing in multiple frameworks — find shared failing signals
  const failingFrameworks = matrix.filter((m) => (m.failing ?? 0) > 0).map((m) => m.framework);

  return NextResponse.json({ matrix, failingFrameworks, generatedAt: new Date().toISOString() });
}
