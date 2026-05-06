/** Bright Data client configuration — zones from the dashboard; gateway URLs optionally regional. */
export interface BrightDataConfig {
  apiKey: string;
  webUnlockerZone: string;
  serpZone: string;
  browserZone: string;
  timeoutMs: number;
  maxRetries: number;
  /**
   * Web Unlocker / super-proxy gateway (HTTPS proxy port Bright Data publishes by default).
   * Override via `BRIGHTDATA_WEB_UNLOCKER_PROXY_URL` if your account uses another host/port.
   */
  webUnlockerProxyUrl?: string;
  /**
   * Base URL for SERP queries issued with SERP-zone proxy authorization.
   * Defaults to the same Bright Data gateway; set `BRIGHTDATA_SERP_API_BASE_URL` if different.
   */
  serpApiBaseUrl?: string;
}

export interface BrightDataFetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface BrightDataFetchResult {
  url: string;
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  resolvedUrl?: string;
}

export interface BrightDataSearchQuery {
  query: string;
  numResults?: number;
  country?: string;
}

export interface BrightDataSearchResult {
  query: string;
  results: BrightDataSearchResultItem[];
}

export interface BrightDataSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

export interface BrightDataScrapeTarget {
  url: string;
  selector?: string;
  waitForSelector?: string;
}

export interface BrightDataScrapeResult {
  url: string;
  html: string;
  text: string;
  links: string[];
  meta: Record<string, string>;
}
