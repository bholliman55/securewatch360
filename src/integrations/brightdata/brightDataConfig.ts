import type { BrightDataConfig } from "./brightDataTypes";

/** Bright Data public super-proxy HTTPS port (override with zone-specific host if Bright Data assigns one). */
export const DEFAULT_BRIGHTDATA_GATEWAY = "https://brd.superproxy.io:22225";

export function getBrightDataConfig(): BrightDataConfig {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const webUnlockerZone = process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE;
  const serpZone = process.env.BRIGHTDATA_SERP_ZONE;
  const browserZone = process.env.BRIGHTDATA_BROWSER_ZONE;
  const webUnlockerProxyUrl =
    process.env.BRIGHTDATA_WEB_UNLOCKER_PROXY_URL?.trim() || DEFAULT_BRIGHTDATA_GATEWAY;
  const serpApiBaseUrl =
    process.env.BRIGHTDATA_SERP_API_BASE_URL?.trim() || DEFAULT_BRIGHTDATA_GATEWAY;

  if (!apiKey) throw new Error("BRIGHTDATA_API_KEY is not set");
  if (!webUnlockerZone) throw new Error("BRIGHTDATA_WEB_UNLOCKER_ZONE is not set");
  if (!serpZone) throw new Error("BRIGHTDATA_SERP_ZONE is not set");
  if (!browserZone) throw new Error("BRIGHTDATA_BROWSER_ZONE is not set");

  return {
    apiKey,
    webUnlockerZone,
    serpZone,
    browserZone,
    webUnlockerProxyUrl,
    serpApiBaseUrl,
    timeoutMs: 30_000,
    maxRetries: 3,
  };
}
