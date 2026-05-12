/**
 * First-class Bright Data MCP intelligence source — public OSINT, external verification, and enrichment.
 */

import { createHash } from "node:crypto";
import {
  BrightDataMcpClient,
  createUnconfiguredBrightDataMcpInvoker,
  isBrightDataMcpMockMode,
  newBrightDataTraceContext,
  type BrightDataMcpInvoker,
} from "./brightDataMcpClient";
import { BrightDataRateLimiter } from "./brightDataRateLimiter";
import {
  normalizeScrapeToSignal,
  normalizeScreenshotToSignal,
  normalizeSearchResultsToSignals,
  refineSignalTypesForNewsAndBreach,
} from "./brightDataNormalizer";
import { assertPublicInternetTargetUrl } from "./brightDataPublicSurfaceGuard";
import type { Sw360ThreatIntelSignal } from "./brightDataSw360Schemas";

export type BrightDataIntelligenceSourceOptions = {
  mcpInvoker?: BrightDataMcpInvoker;
  rateLimiter?: BrightDataRateLimiter;
  /** Force mock fixtures even if env does not request mock mode. */
  forceMock?: boolean;
};

function cacheKey(parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

export class BrightDataIntelligenceSource {
  private readonly client: BrightDataMcpClient;
  private readonly limiter: BrightDataRateLimiter;

  constructor(options: BrightDataIntelligenceSourceOptions = {}) {
    const mock = options.forceMock === true || isBrightDataMcpMockMode();
    const invoker =
      options.mcpInvoker ??
      (mock
        ? async () => ({})
        : createUnconfiguredBrightDataMcpInvoker());
    this.client = new BrightDataMcpClient({
      invoker,
      mockMode: mock,
    });
    this.limiter = options.rateLimiter ?? new BrightDataRateLimiter();
  }

  /** Public web search enrichment (SERP / MCP search tools). */
  async publicWebSearchEnrichment(params: {
    tenantId: string;
    traceId: string;
    correlationId: string;
    query: string;
  }): Promise<Sw360ThreatIntelSignal[]> {
    const raw = await this.limiter.withCacheAndLimit({
      tenantId: params.tenantId,
      cacheKey: cacheKey(["search", params.query]),
      fn: () =>
        this.client.searchWeb({
          query: params.query,
          tenantId: params.tenantId,
          traceId: params.traceId,
          correlationId: params.correlationId,
        }),
    });
    return refineSignalTypesForNewsAndBreach(
      normalizeSearchResultsToSignals(raw, {
        tenant_id: params.tenantId,
        trace_id: params.traceId,
        correlation_id: params.correlationId,
        query: params.query,
        signal_type: "web_search_hit",
      }),
    );
  }

  /**
   * External attack-surface style discovery: public search for host / domain footprint hints.
   * Does not port-scan or probe private addresses — query is validated; only public search is used.
   */
  async externalAttackSurfaceDiscovery(params: {
    tenantId: string;
    traceId: string;
    correlationId: string;
    domain: string;
  }): Promise<Sw360ThreatIntelSignal[]> {
    const q = `site:${params.domain} (security OR certificate OR breach OR exposed OR vulnerability)`;
    const base = await this.publicWebSearchEnrichment({
      tenantId: params.tenantId,
      traceId: params.traceId,
      correlationId: params.correlationId,
      query: q,
    });
    return base.map((s) => ({
      ...s,
      signal_type: "surface_discovery" as const,
    }));
  }

  /** Verifies a **public** URL representing an external asset (e.g. corporate marketing site). */
  async verifyExposedPublicAssetPage(params: {
    tenantId: string;
    traceId: string;
    correlationId: string;
    publicUrl: string;
  }): Promise<Sw360ThreatIntelSignal> {
    assertPublicInternetTargetUrl(params.publicUrl);
    const raw = await this.limiter.withCacheAndLimit({
      tenantId: params.tenantId,
      cacheKey: cacheKey(["scrape", params.publicUrl]),
      fn: () =>
        this.client.scrapePublicPage({
          url: params.publicUrl,
          tenantId: params.tenantId,
          traceId: params.traceId,
          correlationId: params.correlationId,
        }),
    });
    const s = normalizeScrapeToSignal(raw, {
      tenant_id: params.tenantId,
      trace_id: params.traceId,
      correlation_id: params.correlationId,
      source_url: params.publicUrl,
    });
    return { ...s, signal_type: "exposure_verification" };
  }

  /** Company / domain open-source footprint (public search only). */
  async companyDomainIntelligence(params: {
    tenantId: string;
    traceId: string;
    correlationId: string;
    domain: string;
    companyName?: string;
  }): Promise<Sw360ThreatIntelSignal[]> {
    const name = params.companyName?.trim();
    const q = name
      ? `"${name}" OR ${params.domain} (company OR cybersecurity OR incident)`
      : `${params.domain} (company OR cybersecurity OR incident)`;
    return this.publicWebSearchEnrichment({
      tenantId: params.tenantId,
      traceId: params.traceId,
      correlationId: params.correlationId,
      query: q,
    });
  }

  /** Breach / news oriented public queries. */
  async publicBreachAndNewsSignals(params: {
    tenantId: string;
    traceId: string;
    correlationId: string;
    domain: string;
  }): Promise<Sw360ThreatIntelSignal[]> {
    const q = `${params.domain} (data breach OR ransomware OR SEC filing OR cybersecurity news)`;
    const signals = await this.publicWebSearchEnrichment({
      tenantId: params.tenantId,
      traceId: params.traceId,
      correlationId: params.correlationId,
      query: q,
    });
    return refineSignalTypesForNewsAndBreach(signals);
  }

  /** Aggregated enrichment suitable for Agent 2 / dashboards. */
  async collectThreatIntelEnrichment(params: {
    tenantId: string;
    traceId?: string;
    correlationId?: string;
    domain: string;
    companyQuery?: string;
  }): Promise<Sw360ThreatIntelSignal[]> {
    const { traceId, correlationId } =
      params.traceId && params.correlationId
        ? { traceId: params.traceId, correlationId: params.correlationId }
        : newBrightDataTraceContext();

    const company = await this.companyDomainIntelligence({
      tenantId: params.tenantId,
      traceId,
      correlationId,
      domain: params.domain,
      companyName: params.companyQuery,
    });
    const surface = await this.externalAttackSurfaceDiscovery({
      tenantId: params.tenantId,
      traceId,
      correlationId,
      domain: params.domain,
    });
    const news = await this.publicBreachAndNewsSignals({
      tenantId: params.tenantId,
      traceId,
      correlationId,
      domain: params.domain,
    });

    const merged = [...company, ...surface, ...news];
    const dedupe = new Map<string, Sw360ThreatIntelSignal>();
    for (const s of merged) {
      const k = `${s.title}::${s.source_url ?? ""}`;
      if (!dedupe.has(k)) dedupe.set(k, s);
    }
    return [...dedupe.values()];
  }

  async captureEvidenceScreenshot(params: {
    tenantId: string;
    traceId: string;
    correlationId: string;
    publicUrl: string;
  }): Promise<Sw360ThreatIntelSignal> {
    const raw = await this.limiter.withCacheAndLimit({
      tenantId: params.tenantId,
      cacheKey: cacheKey(["shot", params.publicUrl]),
      skipCache: true,
      fn: () =>
        this.client.capturePublicScreenshot({
          url: params.publicUrl,
          tenantId: params.tenantId,
          traceId: params.traceId,
          correlationId: params.correlationId,
        }),
    });
    return normalizeScreenshotToSignal(raw, {
      tenant_id: params.tenantId,
      trace_id: params.traceId,
      correlation_id: params.correlationId,
      source_url: params.publicUrl,
    });
  }
}
