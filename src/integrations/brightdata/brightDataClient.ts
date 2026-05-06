import type {
  BrightDataConfig,
  BrightDataFetchOptions,
  BrightDataFetchResult,
  BrightDataSearchQuery,
  BrightDataSearchResult,
  BrightDataSearchResultItem,
  BrightDataScrapeTarget,
  BrightDataScrapeResult,
} from "./brightDataTypes";
import {
  BrightDataError,
  BrightDataTimeoutError,
  classifyBrightDataError,
} from "./brightDataErrors";

import { DEFAULT_BRIGHTDATA_GATEWAY } from "./brightDataConfig";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  isRetryable: (err: unknown) => boolean
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === maxRetries) break;
      await sleep(500 * Math.pow(2, attempt)); // 500ms, 1s, 2s
    }
  }
  throw lastError;
}

function normalizeGatewayUrl(url: string | undefined): string {
  const t = (url ?? "").trim();
  const base = t.length > 0 ? t.replace(/\/$/, "") : DEFAULT_BRIGHTDATA_GATEWAY;
  return base;
}

/** Extract SERP-like organic rows from common Bright Data / vendor JSON envelopes. */
function parseSerpOrganicResults(data: unknown): BrightDataSearchResultItem[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const organic = root.organic ?? root.organic_results;
  const list = Array.isArray(organic)
    ? organic
    : Array.isArray(root.results)
      ? root.results
      : [];
  const items: BrightDataSearchResultItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title =
      typeof r.title === "string"
        ? r.title
        : typeof r.name === "string"
          ? r.name
          : "";
    const link =
      typeof r.link === "string"
        ? r.link
        : typeof r.url === "string"
          ? r.url
          : typeof r.destination === "string"
            ? r.destination
            : "";
    const snippet =
      typeof r.snippet === "string"
        ? r.snippet
        : typeof r.description === "string"
          ? r.description
          : "";
    if (!title && !link) continue;
    items.push({
      title: title || link,
      url: link,
      snippet,
      position: items.length + 1,
    });
  }
  return items;
}

export class BrightDataClient {
  private readonly serpApiBaseUrl: string;

  constructor(private readonly config: BrightDataConfig) {
    this.serpApiBaseUrl = normalizeGatewayUrl(config.serpApiBaseUrl ?? config.webUnlockerProxyUrl);
  }

  async fetchUrl(url: string, options: BrightDataFetchOptions = {}): Promise<BrightDataFetchResult> {
    return withRetry(
      () => this._fetchUrl(url, options),
      this.config.maxRetries,
      (err) => err instanceof BrightDataError && err.retryable
    );
  }

  /**
   * Fetches the target URL with Web Unlocker headers (`Proxy-Authorization`, `x-crawl-type`).
   * Runtime must route through Bright Data’s proxy (`webUnlockerProxyUrl`): e.g. `HttpsProxyAgent` or a fetch dispatcher that targets that gateway — see Bright Data docs for your runtime.
   */
  private async _fetchUrl(url: string, options: BrightDataFetchOptions): Promise<BrightDataFetchResult> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const proxyAuth = Buffer.from(
        `${this.config.webUnlockerZone}:${this.config.apiKey}`
      ).toString("base64");

      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Proxy-Authorization": `Basic ${proxyAuth}`,
          "x-crawl-type": "web_unlocker",
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw classifyBrightDataError(response.status, `HTTP ${response.status}`);
      }

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headers[k] = v;
      });
      return { url, statusCode: response.status, body, headers };
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new BrightDataTimeoutError("web-unlocker");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async searchWeb(query: BrightDataSearchQuery): Promise<BrightDataSearchResult> {
    return withRetry(
      () => this._searchWeb(query),
      this.config.maxRetries,
      (err) => err instanceof BrightDataError && err.retryable
    );
  }

  /**
   * Sends a SERP-zone proxy request against `config.serpApiBaseUrl`.
   * Response JSON is normalized from `organic` / `organic_results` / `results` arrays when present.
   */
  private async _searchWeb(query: BrightDataSearchQuery): Promise<BrightDataSearchResult> {
    const proxyAuth = Buffer.from(
      `${this.config.serpZone}:${this.config.apiKey}`
    ).toString("base64");

    const searchUrl = `${this.serpApiBaseUrl}?q=${encodeURIComponent(query.query)}&num=${query.numResults ?? 10}&gl=${query.country ?? "us"}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(searchUrl, {
        headers: { "Proxy-Authorization": `Basic ${proxyAuth}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw classifyBrightDataError(response.status, `SERP HTTP ${response.status}`);
      }

      const data: unknown = await response.json();
      const results = parseSerpOrganicResults(data);
      return {
        query: query.query,
        results,
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new BrightDataTimeoutError("serp");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * HTML fetch + link extraction using Web Unlocker (not Scraping Browser / CDP).
   * For browser automation, use Bright Data’s Scraping Browser or Playwright with your zone’s WebSocket URL from the dashboard.
   */
  async browserScrape(target: BrightDataScrapeTarget): Promise<BrightDataScrapeResult> {
    const result = await this.fetchUrl(target.url);
    return {
      url: target.url,
      html: result.body,
      text: result.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      links: extractLinks(result.body, target.url),
      meta: {},
    };
  }

  /**
   * Placeholder for Dataset / structured extraction APIs — currently returns `{ raw: body }`.
   * Prefer Bright Data’s Dataset API or MCP tools for production structured pulls.
   */
  async structuredScrape<T>(url: string, schema: Record<string, string>): Promise<T> {
    const result = await this.fetchUrl(url);
    void schema;
    return { raw: result.body } as unknown as T;
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  const links: string[] = [];
  const base = new URL(baseUrl);
  for (const m of matches) {
    try {
      links.push(new URL(m[1], base).href);
    } catch {
      /* skip malformed */
    }
  }
  return [...new Set(links)].slice(0, 200);
}
