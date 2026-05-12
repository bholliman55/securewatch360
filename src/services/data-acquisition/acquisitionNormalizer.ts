import type { ExternalAssetEvent, OsintIntelligenceEvent, IntelligenceSeverity } from "./acquisitionTypes";

// Deduplication key for external assets: domain + type + value
export function assetDedupeKey(e: Pick<ExternalAssetEvent, "domain" | "assetType" | "assetValue">): string {
  return `${e.domain}|${e.assetType}|${e.assetValue.toLowerCase().trim()}`;
}

// Deduplication key for OSINT events: domain + eventType + evidenceUrl
export function osintDedupeKey(e: Pick<OsintIntelligenceEvent, "domain" | "eventType" | "evidenceUrl">): string {
  return `${e.domain}|${e.eventType}|${e.evidenceUrl ?? ""}`;
}

export function deduplicateAssets(events: ExternalAssetEvent[]): ExternalAssetEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = assetDedupeKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deduplicateOsintEvents(events: OsintIntelligenceEvent[]): OsintIntelligenceEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = osintDedupeKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scoreToSeverity(confidence: number, riskKeywords: string[]): IntelligenceSeverity {
  const text = riskKeywords.join(" ").toLowerCase();
  const hasCritical = /admin|credential|password|root|executive|breach/.test(text);
  const hasHigh = /exploit|cve|vuln|leak|exposed/.test(text);
  if (hasCritical && confidence > 0.7) return "CRITICAL";
  if (hasCritical || (hasHigh && confidence > 0.6)) return "HIGH";
  if (hasHigh || confidence > 0.5) return "MEDIUM";
  return "LOW";
}

// Strip any credential-like values from raw data before storage
export function redactCredentials(preview: string): string {
  return preview
    .replace(/password\s*[:=]\s*\S+/gi, "password:[REDACTED]")
    .replace(/passwd\s*[:=]\s*\S+/gi, "passwd:[REDACTED]")
    .replace(/secret\s*[:=]\s*\S+/gi, "secret:[REDACTED]")
    .replace(/token\s*[:=]\s*[A-Za-z0-9+/=_\-.]{8,}/gi, "token:[REDACTED]")
    .replace(/api[_-]?key\s*[:=]\s*\S+/gi, "api_key:[REDACTED]");
}
