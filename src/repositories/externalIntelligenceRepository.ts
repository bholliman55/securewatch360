import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OsintEvent } from "@/agents/agent2-osint/osintTypes";

export interface ExternalIntelligenceRow {
  id: string;
  scan_id: string | null;
  client_id: string | null;
  domain: string | null;
  company_name: string | null;
  event_type: string;
  severity: string;
  confidence: number | null;
  source_category: string | null;
  evidence_url: string | null;
  redacted_preview: string | null;
  first_seen: string | null;
  last_seen: string | null;
  raw: unknown;
  created_at: string;
}

export async function upsertIntelligenceEvents(events: OsintEvent[]): Promise<void> {
  if (events.length === 0) return;
  const supabase = getSupabaseAdminClient();

  const rows = events.map((e) => ({
    scan_id: e.scanId ?? null,
    client_id: e.clientId ?? null,
    domain: e.domain,
    company_name: e.companyName ?? null,
    event_type: e.eventType,
    severity: e.severity,
    confidence: e.confidence,
    source_category: e.sourceCategory,
    evidence_url: e.evidenceUrl ?? null,
    redacted_preview: e.redactedPreview ?? null,
    first_seen: e.firstSeen?.toISOString() ?? null,
    last_seen: e.lastSeen?.toISOString() ?? null,
    raw: e.raw ?? null,
  }));

  const { error } = await supabase
    .from("external_intelligence_events")
    .upsert(rows, { onConflict: "domain,event_type,evidence_url", ignoreDuplicates: false });

  if (error) throw new Error(`Failed to upsert intelligence events: ${error.message}`);
}

export async function getIntelligenceEvents(
  domain: string,
  options: { clientId?: string; scanId?: string; severity?: string; limit?: number } = {}
): Promise<ExternalIntelligenceRow[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("external_intelligence_events")
    .select("*")
    .eq("domain", domain)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.clientId) query = query.eq("client_id", options.clientId);
  if (options.scanId) query = query.eq("scan_id", options.scanId);
  if (options.severity) query = query.eq("severity", options.severity);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch intelligence events: ${error.message}`);
  return data ?? [];
}
