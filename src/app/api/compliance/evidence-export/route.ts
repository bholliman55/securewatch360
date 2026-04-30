import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { buildEvidencePackage } from "@/lib/evidencePackager";
import { renderEvidenceHtml } from "@/lib/evidencePdfRenderer";

const SUPPORTED_FRAMEWORKS = [
  "NIST", "HIPAA", "PCI-DSS", "ISO 27001", "SOC 2",
  "CMMC", "CIS", "GDPR", "FedRAMP", "CCPA", "COBIT",
];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const framework = searchParams.get("framework");
  const format = searchParams.get("format") ?? "json";

  if (!framework) {
    return NextResponse.json({ error: "framework query param required" }, { status: 400 });
  }
  if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
    return NextResponse.json(
      { error: "Unsupported framework", supported: SUPPORTED_FRAMEWORKS },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser?.tenant_id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 403 });
  }

  const pkg = await buildEvidencePackage(tenantUser.tenant_id as string, framework);

  if (format === "html") {
    const html = renderEvidenceHtml(pkg);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="evidence-${framework.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.html"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: JSON
  return NextResponse.json(pkg, {
    headers: {
      "Content-Disposition": `attachment; filename="evidence-${framework.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
