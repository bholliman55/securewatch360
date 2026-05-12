/**
 * Enriches simulation lab metadata with Bright Data–style public OSINT (mock or live MCP).
 * Outputs are analyst-safe summaries — never weaponized payloads.
 */

import type { Sw360ThreatIntelSignal } from "./brightDataSw360Schemas";
import type { BrightDataIntelligenceSource } from "./brightDataSourceAdapter";
import { newBrightDataTraceContext } from "./brightDataMcpClient";

export type SimulationBrightDataLabAttachment = {
  schema_version: 1;
  scenario_id: string;
  domain: string;
  tenant_id: string;
  trace_id: string;
  correlation_id: string;
  generated_at: string;
  /** High-level strings suitable for investor / lab reports. */
  executive_bullets: string[];
  /** Raw-normalized signals (already tenant-scoped). */
  signals: Sw360ThreatIntelSignal[];
  disclaimer: string;
};

/**
 * Pulls public web context for a scenario's notional domain and returns a bundle you can merge
 * into simulation JSON / Markdown report appendices.
 */
export async function enrichSimulationWithBrightDataPublicIntel(params: {
  scenarioId: string;
  domain: string;
  tenantId: string;
  adapter: BrightDataIntelligenceSource;
  /** Optional trace override for cross-service correlation. */
  traceId?: string;
  correlationId?: string;
}): Promise<SimulationBrightDataLabAttachment> {
  const { traceId, correlationId } =
    params.traceId && params.correlationId
      ? { traceId: params.traceId, correlationId: params.correlationId }
      : newBrightDataTraceContext();

  const signals = await params.adapter.collectThreatIntelEnrichment({
    tenantId: params.tenantId,
    traceId,
    correlationId,
    domain: params.domain,
    companyQuery: params.domain,
  });

  const executive_bullets = signals.slice(0, 5).map((s) => {
    const url = s.source_url ? ` (${s.source_url})` : "";
    return `${s.title}${url}`;
  });

  return {
    schema_version: 1,
    scenario_id: params.scenarioId,
    domain: params.domain,
    tenant_id: params.tenantId,
    trace_id: traceId,
    correlation_id: correlationId,
    generated_at: new Date().toISOString(),
    executive_bullets,
    signals,
    disclaimer:
      "Bright Data enrichment uses public web sources only. No internal or customer-private systems are targeted.",
  };
}
