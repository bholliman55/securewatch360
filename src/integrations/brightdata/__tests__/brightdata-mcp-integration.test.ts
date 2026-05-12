import { describe, expect, it, vi } from "vitest";
import { BrightDataPolicyError, assertPublicInternetTargetUrl } from "../brightDataPublicSurfaceGuard";
import { BrightDataRateLimiter } from "../brightDataRateLimiter";
import type { BrightDataMcpInvoker } from "../brightDataMcpClient";
import { BrightDataIntelligenceSource } from "../brightDataSourceAdapter";
import { signalsToEvidenceInserts } from "../brightDataEvidenceCollector";
import { enrichSimulationWithBrightDataPublicIntel } from "../brightDataSimulationEnricher";

const TENANT = "11111111-1111-4111-8111-111111111111";
const TRACE = "22222222-2222-4222-8222-222222222222";
const CORR = "33333333-3333-4333-8333-333333333333";

const fixtureInvoker: BrightDataMcpInvoker = async (inv) => {
  if (inv.toolName.includes("search") || inv.arguments.query) {
    return {
      organic: [
        {
          title: "Example breach disclosure (fixture)",
          link: "https://example.com/news/breach-fixture",
          snippet: "Company confirms cybersecurity incident and data breach investigation.",
        },
        {
          title: "Internal host should never appear",
          link: "https://example.com/public-page",
          snippet: "Unrelated public content.",
        },
      ],
    };
  }
  if (inv.arguments.url && String(inv.arguments.url).includes("screenshot")) {
    return { image_base64: "AAA", note: "fixture" };
  }
  return { markdown: "# Fixture\n\nScraped **markdown** for tests." };
};

describe("Bright Data MCP integration", () => {
  it("blocks private URLs before any MCP call", () => {
    expect(() => assertPublicInternetTargetUrl("http://192.168.1.1/admin")).toThrow(BrightDataPolicyError);
    expect(() => assertPublicInternetTargetUrl("http://localhost/")).toThrow(BrightDataPolicyError);
  });

  it("normalizes mocked MCP search results with tenant + trace metadata", async () => {
    const limiter = new BrightDataRateLimiter({
      maxPerTenantPerMinute: 100,
      maxGlobalPerMinute: 200,
      defaultCacheTtlMs: 60_000,
    });
    const adapter = new BrightDataIntelligenceSource({
      forceMock: false,
      mcpInvoker: fixtureInvoker,
      rateLimiter: limiter,
    });

    const signals = await adapter.publicWebSearchEnrichment({
      tenantId: TENANT,
      traceId: TRACE,
      correlationId: CORR,
      query: "Example Corp cybersecurity news",
    });

    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0]!.tenant_id).toBe(TENANT);
    expect(signals[0]!.trace_id).toBe(TRACE);
    expect(signals[0]!.correlation_id).toBe(CORR);
    expect(signals[0]!.collected_at).toMatch(/^\d{4}-/);
    expect(typeof signals[0]!.confidence_score).toBe("number");
    expect(signals[0]!.provider).toBe("bright_data_mcp");
  });

  it("maps signals to evidence_records-ready inserts", () => {
    const signals = [
      {
        signal_type: "web_search_hit" as const,
        title: "T",
        summary: "S",
        tenant_id: TENANT,
        trace_id: TRACE,
        correlation_id: CORR,
        source_url: "https://example.com/a",
        collected_at: new Date().toISOString(),
        confidence_score: 0.7,
        provider: "bright_data_mcp" as const,
        metadata: {},
      },
    ];
    const rows = signalsToEvidenceInserts(signals, {
      tenant_id: TENANT,
      trace_id: TRACE,
      correlation_id: CORR,
      finding_id: "44444444-4444-4444-8444-444444444444",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.evidence_type).toBe("external_intelligence");
    expect(rows[0]!.payload.trace_id).toBe(TRACE);
    expect(rows[0]!.payload.correlation_id).toBe(CORR);
    expect(rows[0]!.payload.source_url).toBe("https://example.com/a");
  });

  it("returns cached search results for identical tenant + query", async () => {
    const invoker = vi.fn(fixtureInvoker);
    const limiter = new BrightDataRateLimiter({
      maxPerTenantPerMinute: 100,
      maxGlobalPerMinute: 200,
      defaultCacheTtlMs: 300_000,
    });
    const adapter = new BrightDataIntelligenceSource({
      forceMock: false,
      mcpInvoker: invoker,
      rateLimiter: limiter,
    });

    await adapter.publicWebSearchEnrichment({
      tenantId: TENANT,
      traceId: TRACE,
      correlationId: CORR,
      query: "cache-key-query-unique",
    });
    await adapter.publicWebSearchEnrichment({
      tenantId: TENANT,
      traceId: TRACE,
      correlationId: CORR,
      query: "cache-key-query-unique",
    });
    expect(invoker).toHaveBeenCalledTimes(1);
  });

  it("enriches simulation lab metadata in mock mode without MCP invoker", async () => {
    const adapter = new BrightDataIntelligenceSource({ forceMock: true });
    const bundle = await enrichSimulationWithBrightDataPublicIntel({
      scenarioId: "lab-scenario-1",
      domain: "example.com",
      tenantId: TENANT,
      adapter,
    });
    expect(bundle.schema_version).toBe(1);
    expect(bundle.signals.length).toBeGreaterThan(0);
    expect(bundle.disclaimer).toContain("public web");
  });
});
