/**
 * SecureWatch360 shapes for Bright Data–derived intelligence and evidence payloads.
 * Stored under evidence_records.payload and used by OSINT / external intel flows.
 */

/** Normalized external threat / OSINT signal (not a DB row — embedded in evidence or passed to agents). */
export interface Sw360ThreatIntelSignal {
  signal_type:
    | "web_search_hit"
    | "news_mention"
    | "breach_mention"
    | "surface_discovery"
    | "exposure_verification"
    | "scraped_page_summary"
    | "screenshot_capture"
    | "structured_intel";
  title: string;
  summary: string;
  tenant_id: string;
  trace_id: string;
  correlation_id: string;
  source_url?: string;
  collected_at: string;
  /** 0–1 confidence from Bright Data match quality + heuristics. */
  confidence_score: number;
  provider: "bright_data_mcp";
  metadata: Record<string, unknown>;
}

/** Row shape aligned with evidence_records insert (server-side). */
export interface Sw360BrightDataEvidenceInsert {
  tenant_id: string;
  scan_run_id?: string | null;
  finding_id?: string | null;
  control_framework: string;
  control_id: string;
  evidence_type: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
}
