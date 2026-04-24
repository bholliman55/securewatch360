import { writeAuditLog } from "@/lib/audit";
import { recordClientLearning } from "@/lib/clientLearning";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type AwarenessSignalType = "real_world" | "company";

export async function ingestAwarenessSignals(input: {
  tenantId: string;
  signalType: AwarenessSignalType;
  source: string;
  signals: string[];
  actorUserId: string | null;
}): Promise<{ ingestedCount: number; evidenceRecordIds: string[] }> {
  const signals = input.signals
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 200);
  if (signals.length === 0) {
    return { ingestedCount: 0, evidenceRecordIds: [] };
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("evidence_records")
    .insert(
      signals.map((signal) => ({
        tenant_id: input.tenantId,
        control_framework: "securewatch_internal",
        control_id: "SW-AWARENESS-SIGNAL",
        evidence_type: "awareness_signal",
        title: `Awareness signal (${input.signalType})`,
        description: `Signal ingested from ${input.source} for adaptive security training.`,
        payload: {
          signalType: input.signalType,
          signal,
          source: input.source,
          observedAt: now,
        },
      }))
    )
    .select("id");

  if (error) {
    throw new Error(`Failed ingesting awareness signals: ${error.message}`);
  }

  await writeAuditLog({
    userId: input.actorUserId,
    tenantId: input.tenantId,
    entityType: "system",
    entityId: `awareness-signals:${now}`,
    action: "awareness.signals.ingested",
    summary: `Ingested ${signals.length} awareness signal(s) from ${input.source}`,
    payload: {
      signalType: input.signalType,
      source: input.source,
      count: signals.length,
    },
  });

  await recordClientLearning({
    tenantId: input.tenantId,
    source: "api",
    interactionKind: "feedback",
    title: `Awareness signals ingested (${input.signalType})`,
    body: `Captured ${signals.length} awareness signal(s) from ${input.source}.`,
    structuredSignals: {
      signalType: input.signalType,
      source: input.source,
      signalCount: signals.length,
      sample: signals.slice(0, 5),
    },
    impact: "medium",
    productArea: "awareness",
    relatedEntityType: "system",
    createdBy: input.actorUserId,
  });

  return {
    ingestedCount: signals.length,
    evidenceRecordIds: (data ?? []).map((row) => row.id as string),
  };
}
