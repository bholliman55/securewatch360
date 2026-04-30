import type {
  BrightDataConfig,
  BrightDataFetchOptions,
  BrightDataFetchResult,
  BrightDataSearchQuery,
  BrightDataSearchResult,
  BrightDataScrapeTarget,
  BrightDataScrapeResult,
} from "./brightDataTypes";
import {
  BrightDataError,
  BrightDataTimeoutError,
  classifyBrightDataError,
} from "./brightDataErrors";

// Wire: replace with actual endpoint from your Bright Data zone dashboard.
const WEB_UNLOCKER_ENDPOINT = "https://brd.superproxy.io:22225";
// Wire: replace with endpoint from your SERP zone configuration.
const SERP_API_ENDPOINT = "https://brd.superproxy.io:22225";

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

export class BrightDataClient {
  constructor(private readonly config: BrightDataConfig) {}

  async fetchUrl(url: string, options: BrightDataFetchOptions = {}): Promise<BrightDataFetchResult> {
    return withRetry(
      () => this._fetchUrl(url, options),
      this.config.maxRetries,
      (err) => err instanceof BrightDataError && err.retryable
    );
  }

  private async _fetchUrl(url: string, options: BrightDataFetchOptions): Promise<BrightDataFetchResult> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Wire: Bright Data Web Unlocker uses HTTP proxy auth.
      // Proxy-Authorization: Basic base64(zone:apiKey)
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
        // Do not include the URL in the error — it may contain proxy auth context.
        throw classifyBrightDataError(response.status, `HTTP ${response.status}`);
      }

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
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

  private async _searchWeb(query: BrightDataSearchQuery): Promise<BrightDataSearchResult> {
    // Wire: replace with actual Bright Data SERP API call using serpZone credentials.
    const proxyAuth = Buffer.from(
      `${this.config.serpZone}:${this.config.apiKey}`
    ).toString("base64");

    const searchUrl = `${SERP_API_ENDPOINT}?q=${encodeURIComponent(query.query)}&num=${query.numResults ?? 10}&gl=${query.country ?? "us"}`;
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

      // Wire: parse actual Bright Data SERP JSON response format here.
      const data = await response.json() as { organic?: Array<{ title: string; link: string; snippet: string }> };
      return {
        query: query.query,
        results: (data.organic ?? []).map((r, i) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          position: i + 1,
        })),
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new BrightDataTimeoutError("serp");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Wire: Bright Data Scraping Browser uses Puppeteer/Playwright over CDP.
  // Connect via: wss://brd.superproxy.io:9222?auth=browserZone:apiKey
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

  // Wire: use Bright Data Dataset API or custom extraction datasets for structured output.
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
    try { links.push(new URL(m[1], base).href); } catch { /* skip malformed */ }
  }
  return [...new Set(links)].slice(0, 200);
}
