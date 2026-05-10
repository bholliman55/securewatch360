/**
 * Maps normalized Bright Data signals to evidence_records rows and optional persistence.
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Sw360BrightDataEvidenceInsert, Sw360ThreatIntelSignal } from "./brightDataSw360Schemas";

const CONTROL_FRAMEWORK = "securewatch_internal";
const CONTROL_ID = "SW-BRIGHTDATA-OSINT";

export type BrightDataEvidenceContext = {
  tenant_id: string;
  trace_id: string;
  correlation_id: string;
  scan_run_id?: string | null;
  finding_id?: string | null;
};

export function signalsToEvidenceInserts(
  signals: Sw360ThreatIntelSignal[],
  ctx: BrightDataEvidenceContext,
): Sw360BrightDataEvidenceInsert[] {
  return signals.map((s, i) => ({
    tenant_id: ctx.tenant_id,
    scan_run_id: ctx.scan_run_id ?? null,
    finding_id: ctx.finding_id ?? null,
    control_framework: CONTROL_FRAMEWORK,
    control_id: CONTROL_ID,
    evidence_type: "external_intelligence",
    title: s.title.slice(0, 500),
    description: s.summary.slice(0, 4000),
    payload: {
      ...s,
      tenant_id: ctx.tenant_id,
      trace_id: ctx.trace_id,
      correlation_id: ctx.correlation_id,
      source_url: s.source_url,
      collected_at: s.collected_at,
      confidence_score: s.confidence_score,
      signal_index: i,
    },
  }));
}

export async function persistBrightDataEvidenceRows(rows: Sw360BrightDataEvidenceInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("evidence_records")
    .insert(
      rows.map((r) => ({
        tenant_id: r.tenant_id,
        scan_run_id: r.scan_run_id,
        finding_id: r.finding_id,
        control_framework: r.control_framework,
        control_id: r.control_id,
        evidence_type: r.evidence_type,
        title: r.title,
        description: r.description,
        payload: r.payload as never,
      })),
    )
    .select("id");

  if (error) {
    throw new Error(`evidence_records insert failed: ${error.message}`);
  }
  return data?.length ?? rows.length;
}
