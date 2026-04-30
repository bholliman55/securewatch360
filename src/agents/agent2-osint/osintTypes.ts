export type OsintSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface OsintCollectionInput {
  clientId?: string;
  domain: string;
  companyName?: string;
  knownEmails?: string[];
  scanId?: string;
}

export interface OsintEvent {
  scanId?: string;
  clientId?: string;
  domain: string;
  companyName?: string;
  eventType: string;
  severity: OsintSeverity;
  confidence: number;
  sourceCategory: string;
  evidenceUrl?: string;
  redactedPreview?: string;
  firstSeen?: Date;
  lastSeen?: Date;
  raw?: unknown;
}

export interface OsintCollectionResult {
  domain: string;
  totalEvents: number;
  dedupeCount: number;
  severityBreakdown: Record<OsintSeverity, number>;
  events: OsintEvent[];
  errors: string[];
  completedAt: Date;
}
