export interface BrightDataConfig {
  apiKey: string;
  webUnlockerZone: string;
  serpZone: string;
  browserZone: string;
  timeoutMs: number;
  maxRetries: number;
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
