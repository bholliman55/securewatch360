import type { BrightDataConfig } from "./brightDataTypes";

export function getBrightDataConfig(): BrightDataConfig {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const webUnlockerZone = process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE;
  const serpZone = process.env.BRIGHTDATA_SERP_ZONE;
  const browserZone = process.env.BRIGHTDATA_BROWSER_ZONE;

  if (!apiKey) throw new Error("BRIGHTDATA_API_KEY is not set");
  if (!webUnlockerZone) throw new Error("BRIGHTDATA_WEB_UNLOCKER_ZONE is not set");
  if (!serpZone) throw new Error("BRIGHTDATA_SERP_ZONE is not set");
  if (!browserZone) throw new Error("BRIGHTDATA_BROWSER_ZONE is not set");

  return {
    apiKey,
    webUnlockerZone,
    serpZone,
    browserZone,
    timeoutMs: 30_000,
    maxRetries: 3,
  };
}
