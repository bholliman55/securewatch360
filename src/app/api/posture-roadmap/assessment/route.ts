import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant-guard";
import {
  generateNewPostureAssessment,
  PostureRoadmapError,
} from "@/features/posture-roadmap/services/postureRoadmapService";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

const ERROR_STATUS: Record<string, number> = {
  TENANT_NOT_FOUND: 404,
  ASSESSMENT_NOT_FOUND: 404,
  UNAUTHORIZED: 403,
  INVALID_FRAMEWORK: 400,
  NO_SCAN_DATA: 422,
  SUPABASE_ERROR: 500,
};

const ERROR_HINTS: Partial<Record<string, string>> = {
  NO_SCAN_DATA: "Run a vulnerability scan to populate findings, then generate an assessment.",
  INVALID_FRAMEWORK: "Valid frameworks: CIS, NIST, CMMC_L1, CMMC_L2, HIPAA, SOC2.",
};

/**
 * POST /api/posture-roadmap/assessment
 *
 * Body: { tenantId, targetFramework, assessmentName?, clientId? }
 *
 * Runs the full assessment pipeline:
 *   buildPostureScoringInput → generatePostureAssessment → createPostureAssessment
 *
 * Returns the new assessmentId and top-level result metrics.
 * Always proceeds even when live data is sparse; isEstimated=true when inputs
 * are zero-valued (MFA/backup/training have no DB backing).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = ((body.tenantId as string) ?? "").trim();
    const targetFramework = ((body.targetFramework as string) ?? "CMMC_L2").trim().toUpperCase();
    const assessmentName = ((body.assessmentName as string) ?? "").trim() || undefined;
    const clientId = ((body.clientId as string) ?? "").trim() || undefined;

    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json(
        { ok: false, error: "tenantId must be a valid UUID" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const { assessment, result } = await generateNewPostureAssessment(
      tenantId,
      targetFramework,
      clientId,
      assessmentName
    );

    return NextResponse.json(
      {
        ok: true,
        assessmentId: assessment.id,
        overallScore: result.overallScore,
        maturityLabel: result.maturityLabel,
        targetFramework: result.targetFramework,
        readinessPercentage: result.readinessPercentage,
        isEstimated: result.isEstimated,
        gapCount: result.gaps.length,
        roadmapItemCount: result.roadmapItems.length,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PostureRoadmapError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          hint: ERROR_HINTS[error.code],
        },
        { status: ERROR_STATUS[error.code] ?? 500 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to generate assessment", message },
      { status: 500 }
    );
  }
}
