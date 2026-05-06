import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { API_TENANT_ROLES } from "@/lib/apiRoleMatrix";
import { persistQuantumReadinessOutput } from "@/lib/quantumAssessmentPersistence";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { runQuantumReadinessAssessment } from "@/agents/agent6-quantum-readiness";
import type { QuantumAssessmentInput } from "@/agents/agent6-quantum-readiness";
import type { RawScanFinding, VendorMetadata } from "@/agents/agent6-quantum-readiness/types";
import type { ManualAssetPayload } from "@/agents/agent6-quantum-readiness/cryptoInventoryScanner";

type PostBody = {
  tenantId?: string;
  scanId?: string;
  scanFindings?: RawScanFinding[];
  assets?: ManualAssetPayload[];
  vendorMetadata?: VendorMetadata[];
  options?: QuantumAssessmentInput["options"];
  /** When true (default), persist inventory / assessment / tasks / policy rows via service role */
  persist?: boolean;
};

/**
 * POST Agent 6 quantum readiness assessment (+ optional persistence).
 * Tenant-scoped; uses admin client only for DB writes inside `persistQuantumReadinessOutput`.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "tenantId is required" }, { status: 400 });
  }

  const guard = await requireTenantAccess({
    tenantId,
    allowedRoles: [...API_TENANT_ROLES.remediationAndScan],
  });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const persist = body.persist !== false;

  const input: QuantumAssessmentInput = {
    clientId: tenantId,
    scanId: typeof body.scanId === "string" && body.scanId.trim() ? body.scanId.trim() : undefined,
    scanFindings: Array.isArray(body.scanFindings) ? body.scanFindings : [],
    assets: Array.isArray(body.assets) ? body.assets : [],
    vendorMetadata: Array.isArray(body.vendorMetadata) ? body.vendorMetadata : [],
    options: body.options,
  };

  try {
    const output = await runQuantumReadinessAssessment(input);
    const persistOutcome = persist ? await persistQuantumReadinessOutput(output) : null;

    return NextResponse.json(
      {
        ok: true,
        assessment: output.assessment,
        meta: output.meta,
        inventoryCount: output.inventory.length,
        remediationTaskCount: output.remediationTasks.length,
        policyResultCount: output.policyResults.length,
        persist: persistOutcome,
      },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Quantum assessment failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
