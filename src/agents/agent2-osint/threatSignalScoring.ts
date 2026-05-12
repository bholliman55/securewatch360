import type { OsintEvent, OsintSeverity } from "./osintTypes";

interface ScoringContext {
  eventType: string;
  confidence: number;
  sourceCategory: string;
  preview?: string;
}

export function scoreOsintEvent(ctx: ScoringContext): OsintSeverity {
  const text = [ctx.eventType, ctx.sourceCategory, ctx.preview ?? ""].join(" ").toLowerCase();

  // Critical: admin/executive credential exposure or active exploit against known asset
  const isCritical =
    (ctx.eventType === "credential_exposure" && /admin|root|executive|ceo|cto|ciso/.test(text)) ||
    (ctx.eventType === "exploit_chatter" && ctx.confidence > 0.8) ||
    (ctx.eventType === "breach_reference" && /admin|domain/.test(text));

  // High: any credential exposure, high-confidence exploit mention, breach reference
  const isHigh =
    ctx.eventType === "credential_exposure" ||
    (ctx.eventType === "exploit_chatter" && ctx.confidence > 0.6) ||
    (ctx.eventType === "breach_reference" && ctx.confidence > 0.65) ||
    (ctx.eventType === "compromised_account" && ctx.confidence > 0.6);

  // Medium: vulnerability mentions, vendor advisories with moderate confidence
  const isMedium =
    ctx.eventType === "vulnerability_mention" ||
    ctx.eventType === "vendor_advisory" ||
    ctx.eventType === "paste_site_mention" ||
    ctx.confidence > 0.5;

  if (isCritical) return "CRITICAL";
  if (isHigh) return "HIGH";
  if (isMedium) return "MEDIUM";
  return "LOW";
}

export function rescore(events: OsintEvent[]): OsintEvent[] {
  return events.map((e) => ({
    ...e,
    severity: scoreOsintEvent({
      eventType: e.eventType,
      confidence: e.confidence,
      sourceCategory: e.sourceCategory,
      preview: e.redactedPreview,
    }),
  }));
}
