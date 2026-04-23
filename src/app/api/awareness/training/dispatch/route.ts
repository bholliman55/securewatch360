import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccess } from "@/lib/tenant-guard";
import type { AwarenessTrainingPlan, AwarenessTrainingRecommendation } from "@/lib/securityAwareness";

type DispatchBody = {
  tenantId?: unknown;
  channels?: unknown;
};

type DispatchChannel = "email" | "slack" | "lms";

type ScanRunWithPlan = {
  id: string;
  result_summary: {
    awarenessTrainingPlan?: AwarenessTrainingPlan;
  } | null;
};

const ALLOWED_CHANNELS: DispatchChannel[] = ["email", "slack", "lms"];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeChannels(raw: unknown): DispatchChannel[] {
  if (!Array.isArray(raw)) return ["email", "slack"];
  const channels = raw
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter((value): value is DispatchChannel => ALLOWED_CHANNELS.includes(value as DispatchChannel));
  return channels.length > 0 ? Array.from(new Set(channels)) : ["email", "slack"];
}

function recommendationToPayload(
  recommendation: AwarenessTrainingRecommendation,
  channels: DispatchChannel[],
  dispatchedAt: string
): Record<string, unknown> {
  return {
    dispatchedAt,
    topic: recommendation.topic,
    priority: recommendation.priority,
    audience: recommendation.audience,
    trainingFormat: recommendation.trainingFormat,
    rationale: recommendation.rationale,
    basedOn: recommendation.basedOn,
    delivery: channels.map((channel) => ({
      channel,
      status: "queued",
    })),
  };
}

export async function POST(request: Request) {
  try {
    let body: DispatchBody;
    try {
      body = (await request.json()) as DispatchBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !isUuid(tenantId)) {
      return NextResponse.json({ ok: false, error: "tenantId must be a valid UUID" }, { status: 400 });
    }

    const channels = normalizeChannels(body.channels);
    const guard = await requireTenantAccess({
      tenantId,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data: latestRun, error: runError } = await supabase
      .from("scan_runs")
      .select("id, result_summary")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<ScanRunWithPlan>();

    if (runError) {
      throw new Error(`Could not load latest scan run: ${runError.message}`);
    }
    if (!latestRun) {
      return NextResponse.json(
        { ok: false, error: "No completed scan runs available for training dispatch" },
        { status: 404 }
      );
    }

    const plan = latestRun.result_summary?.awarenessTrainingPlan ?? null;
    if (!plan || !Array.isArray(plan.recommendations) || plan.recommendations.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Latest scan run does not contain awareness training recommendations" },
        { status: 409 }
      );
    }

    const dispatchedAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("evidence_records")
      .insert(
        plan.recommendations.map((recommendation) => ({
          tenant_id: tenantId,
          scan_run_id: latestRun.id,
          control_framework: "securewatch_internal",
          control_id: "SW-AWARENESS-DISPATCH",
          evidence_type: "awareness_training_dispatch",
          title: `Awareness training dispatch: ${recommendation.topic}`,
          description: "Queued awareness training recommendation for delivery channels.",
          payload: recommendationToPayload(recommendation, channels, dispatchedAt),
        }))
      )
      .select("id");

    if (insertError) {
      throw new Error(`Could not persist training dispatch records: ${insertError.message}`);
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId,
      entityType: "system",
      entityId: `awareness-training:${latestRun.id}`,
      action: "awareness.training.dispatched",
      summary: `Dispatched ${plan.recommendations.length} awareness training recommendation(s)`,
      payload: {
        scanRunId: latestRun.id,
        channels,
        dispatchedCount: plan.recommendations.length,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        scanRunId: latestRun.id,
        channels,
        dispatchedCount: plan.recommendations.length,
        evidenceRecordIds: (inserted ?? []).map((row) => row.id),
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to dispatch awareness training", message },
      { status: 500 }
    );
  }
}
