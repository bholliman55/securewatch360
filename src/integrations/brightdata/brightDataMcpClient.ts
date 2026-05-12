/**
 * Bright Data MCP client — invokes MCP tools (search, scrape, screenshot) behind a stable interface.
 * Use {@link isBrightDataMcpMockMode} for local tests without live MCP or Bright Data credentials.
 */

import { randomUUID } from "node:crypto";
import { assertPublicInternetTargetUrl, assertPublicOsintSearchQuery } from "./brightDataPublicSurfaceGuard";

export type BrightDataMcpToolInvocation = {
  server: string;
  toolName: string;
  arguments: Record<string, unknown>;
};

/**
 * Runtime bridge to MCP (implemented in Cursor/host process or a worker that proxies MCP JSON-RPC).
 */
export type BrightDataMcpInvoker = (invocation: BrightDataMcpToolInvocation) => Promise<unknown>;

export type BrightDataMcpClientOptions = {
  invoker: BrightDataMcpInvoker;
  /** When true, never calls invoker — returns deterministic fixtures. */
  mockMode: boolean;
  mcpServerId?: string;
  searchToolName?: string;
  scrapeToolName?: string;
};

const DEFAULT_SERVER = "user-brightdata-mcp";
const DEFAULT_SEARCH_TOOL = "search_engine";
const DEFAULT_SCRAPE_TOOL = "scrape_as_markdown";

export function defaultBrightDataMcpServerId(): string {
  return process.env.BRIGHTDATA_MCP_SERVER?.trim() || DEFAULT_SERVER;
}

export function defaultBrightDataSearchToolName(): string {
  return process.env.BRIGHTDATA_MCP_SEARCH_TOOL?.trim() || DEFAULT_SEARCH_TOOL;
}

export function defaultBrightDataScrapeToolName(): string {
  return process.env.BRIGHTDATA_MCP_SCRAPE_TOOL?.trim() || DEFAULT_SCRAPE_TOOL;
}

export function isBrightDataMcpMockMode(): boolean {
  const v = process.env.BRIGHTDATA_MCP_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function mockSearchEnvelope(query: string): unknown {
  return {
    organic: [
      {
        title: `[MOCK] Public search hit for: ${query}`,
        link: "https://example.com/public-osint-mock",
        snippet: "Synthetic Bright Data MCP mock result. No live Bright Data call was made.",
      },
    ],
  };
}

function mockScrapeEnvelope(url: string): unknown {
  return {
    markdown: `# Mock scrape\n\nSource: ${url}\n\nThis is synthetic markdown for local tests.`,
  };
}

function mockScreenshotEnvelope(url: string): unknown {
  return {
    image_base64: "",
    note: `Mock screenshot placeholder for ${url}`,
  };
}

export class BrightDataMcpClient {
  private readonly serverId: string;

  constructor(private readonly options: BrightDataMcpClientOptions) {
    this.serverId = options.mcpServerId ?? defaultBrightDataMcpServerId();
  }

  async searchWeb(params: {
    query: string;
    engine?: string;
    tenantId: string;
    traceId: string;
    correlationId: string;
  }): Promise<unknown> {
    assertPublicOsintSearchQuery(params.query);
    if (this.options.mockMode) {
      return mockSearchEnvelope(params.query);
    }
    return this.options.invoker({
      server: this.serverId,
      toolName: this.options.searchToolName ?? defaultBrightDataSearchToolName(),
      arguments: {
        query: params.query,
        ...(params.engine ? { engine: params.engine } : {}),
        tenant_id: params.tenantId,
        trace_id: params.traceId,
        correlation_id: params.correlationId,
      },
    });
  }

  async scrapePublicPage(params: {
    url: string;
    tenantId: string;
    traceId: string;
    correlationId: string;
  }): Promise<unknown> {
    assertPublicInternetTargetUrl(params.url);
    if (this.options.mockMode) {
      return mockScrapeEnvelope(params.url);
    }
    return this.options.invoker({
      server: this.serverId,
      toolName: this.options.scrapeToolName ?? defaultBrightDataScrapeToolName(),
      arguments: {
        url: params.url,
        tenant_id: params.tenantId,
        trace_id: params.traceId,
        correlation_id: params.correlationId,
      },
    });
  }

  /**
   * Screenshot / visual evidence — must target a public URL only (policy enforced before MCP).
   * Tool name is configurable; many Bright Data setups expose browser automation under a dedicated MCP tool.
   */
  async capturePublicScreenshot(params: {
    url: string;
    tenantId: string;
    traceId: string;
    correlationId: string;
    mcpScreenshotToolName?: string;
  }): Promise<unknown> {
    assertPublicInternetTargetUrl(params.url);
    const tool =
      params.mcpScreenshotToolName?.trim() ||
      process.env.BRIGHTDATA_MCP_SCREENSHOT_TOOL?.trim() ||
      "browser_take_screenshot";
    if (this.options.mockMode) {
      return mockScreenshotEnvelope(params.url);
    }
    return this.options.invoker({
      server: this.serverId,
      toolName: tool,
      arguments: {
        url: params.url,
        tenant_id: params.tenantId,
        trace_id: params.traceId,
        correlation_id: params.correlationId,
      },
    });
  }
}

/** Fails closed invoker for environments where MCP is not wired — use mock mode in tests. */
export function createUnconfiguredBrightDataMcpInvoker(): BrightDataMcpInvoker {
  return () =>
    Promise.reject(
      new Error(
        "Bright Data MCP invoker is not configured. Set BRIGHTDATA_MCP_MOCK=true for tests or inject BrightDataMcpClientOptions.invoker.",
      ),
    );
}

export function newBrightDataTraceContext(): { traceId: string; correlationId: string } {
  return { traceId: randomUUID(), correlationId: randomUUID() };
}
