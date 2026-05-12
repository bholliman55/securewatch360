/**
 * Bright Data MCP enrichment for Agent 2 OSINT — public web intelligence, OSINT, and exposure-style signals.
 * Never targets private networks; relies on {@link BrightDataIntelligenceSource} guards.
 */

import { newBrightDataTraceContext, isBrightDataMcpMockMode, type BrightDataMcpInvoker } from "@/integrations/brightdata/brightDataMcpClient";
import { BrightDataIntelligenceSource } from "@/integrations/brightdata/brightDataSourceAdapter";
import {
  persistBrightDataEvidenceRows,
  signalsToEvidenceInserts,
} from "@/integrations/brightdata/brightDataEvidenceCollector";
import type { Sw360ThreatIntelSignal } from "@/integrations/brightdata/brightDataSw360Schemas";
import type { OsintCollectionInput } from "./osintTypes";
import type { OsintIntelligenceEvent } from "@/services/data-acquisition/acquisitionTypes";
import { scoreToSeverity, redactCredentials } from "@/services/data-acquisition/acquisitionNormalizer";

let runtimeInvoker: BrightDataMcpInvoker | null = null;

/** Optional host wiring (e.g. MCP bridge worker) — not used unless set. */
export function setBrightDataMcpInvokerForRuntime(invoker: BrightDataMcpInvoker | null): void {
  runtimeInvoker = invoker;
}

export function getBrightDataMcpInvokerFromRuntime(): BrightDataMcpInvoker | null {
  return runtimeInvoker;
}

function explicitEnrichmentRequested(): boolean {
  const v = process.env.BRIGHTDATA_MCP_ENRICHMENT?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function enrichmentDisabled(): boolean {
  return process.env.BRIGHTDATA_MCP_ENRICHMENT?.trim().toLowerCase() === "false";
}

/**
 * MCP enrichment runs in mock mode (fixtures), or when explicitly enabled with a tenant id
 * and a configured runtime invoker (non-mock).
 */
export function shouldRunBrightDataMcpOsintEnrichment(input: OsintCollectionInput): boolean {
  if (enrichmentDisabled()) return false;
  if (isBrightDataMcpMockMode()) return true;
  if (!explicitEnrichmentRequested()) return false;
  return Boolean(input.tenantId?.trim());
}

function signalToOsintEvent(
  s: Sw360ThreatIntelSignal,
  input: OsintCollectionInput,
  traceId: string,
  correlationId: string,
): OsintIntelligenceEvent {
  const now = new Date(s.collected_at);
  const preview = redactCredentials(s.summary.slice(0, 500));
  const severity = scoreToSeverity(s.confidence_score, [s.title, s.summary, s.signal_type]);

  return {
    scanId: input.scanId,
    clientId: input.clientId,
    domain: input.domain,
    companyName: input.companyName,
    eventType: "bright_data_mcp_intel",
    severity,
    confidence: s.confidence_score,
    sourceCategory: "bright_data_mcp",
    evidenceUrl: s.source_url,
    redactedPreview: preview,
    firstSeen: now,
    lastSeen: now,
    raw: {
      bright_data_mcp: {
        signal_type: s.signal_type,
        trace_id: traceId,
        correlation_id: correlationId,
        tenant_id: s.tenant_id,
        provider: s.provider,
        metadata: s.metadata,
      },
    },
  };
}

export async function collectBrightDataMcpOsintEnrichment(
  input: OsintCollectionInput,
): Promise<OsintIntelligenceEvent[]> {
  if (!shouldRunBrightDataMcpOsintEnrichment(input)) return [];

  const mock = isBrightDataMcpMockMode();
  const invoker = getBrightDataMcpInvokerFromRuntime();
  if (!mock && !invoker) {
    return [];
  }

  const tenantId =
    input.tenantId?.trim() ||
    (mock ? "00000000-0000-4000-8000-000000000000" : "");
  if (!tenantId) return [];

  const { traceId, correlationId } = newBrightDataTraceContext();

  const adapter = new BrightDataIntelligenceSource(
    mock ? { forceMock: true } : { forceMock: false, mcpInvoker: invoker! },
  );

  const signals = await adapter.collectThreatIntelEnrichment({
    tenantId,
    traceId,
    correlationId,
    domain: input.domain,
    companyQuery: input.companyName,
  });

  if (input.tenantId && input.scanId && signals.length > 0) {
    try {
      const rows = signalsToEvidenceInserts(signals, {
        tenant_id: input.tenantId,
        trace_id: traceId,
        correlation_id: correlationId,
        scan_run_id: input.scanId,
      });
      await persistBrightDataEvidenceRows(rows);
    } catch {
      /* evidence persistence is best-effort; OSINT events still attach to findings */
    }
  }

  return signals.map((s) => signalToOsintEvent(s, input, traceId, correlationId));
}
