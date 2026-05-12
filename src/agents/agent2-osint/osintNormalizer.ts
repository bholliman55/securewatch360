import type { OsintIntelligenceEvent } from "@/services/data-acquisition/acquisitionTypes";
import type { OsintEvent, OsintSeverity, OsintCollectionResult } from "./osintTypes";

export function normalizeToOsintEvent(event: OsintIntelligenceEvent): OsintEvent {
  return {
    scanId: event.scanId,
    clientId: event.clientId,
    domain: event.domain,
    companyName: event.companyName,
    eventType: event.eventType,
    severity: event.severity as OsintSeverity,
    confidence: event.confidence,
    sourceCategory: event.sourceCategory,
    evidenceUrl: event.evidenceUrl,
    redactedPreview: event.redactedPreview,
    firstSeen: event.firstSeen,
    lastSeen: event.lastSeen,
    raw: event.raw,
  };
}

export function buildSeverityBreakdown(events: OsintEvent[]): Record<OsintSeverity, number> {
  const breakdown: Record<OsintSeverity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const e of events) {
    breakdown[e.severity] = (breakdown[e.severity] ?? 0) + 1;
  }
  return breakdown;
}
