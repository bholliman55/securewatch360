import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

const ALL_FRAMEWORKS = [
  { id: "NIST", label: "NIST CSF" },
  { id: "HIPAA", label: "HIPAA" },
  { id: "PCI-DSS", label: "PCI DSS" },
  { id: "ISO 27001", label: "ISO 27001" },
  { id: "SOC 2", label: "SOC 2" },
  { id: "CMMC", label: "CMMC" },
  { id: "CIS", label: "CIS Controls" },
  { id: "GDPR", label: "GDPR" },
  { id: "FedRAMP", label: "FedRAMP" },
  { id: "CCPA", label: "CCPA" },
  { id: "COBIT", label: "COBIT" },
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser?.tenant_id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
  }

  // Return frameworks that have at least one posture row for this tenant
  const { data: postureRows } = await supabase
    .from("tenant_compliance_posture")
    .select("framework")
    .eq("tenant_id", tenantUser.tenant_id as string);

  const activeFrameworks = new Set((postureRows ?? []).map((r) => r.framework as string));

  const frameworks = ALL_FRAMEWORKS.map((f) => ({
    ...f,
    hasData: activeFrameworks.has(f.id),
  }));

  return NextResponse.json({ frameworks });
}
