/**
 * Normalized threat intelligence artifacts — dedupe keys on (source_feed, ioc_type, ioc_value).
 */

import { z } from "zod";

export const THREAT_INTEL_FEEDS = [
  "cisa_kev",
  "nvd_cve",
  "osv",
  "abuse_ch",
  "alienvault_otx",
  "greynoise",
  "misp",
  "microsoft_threat_intel_stub",
] as const;

export type ThreatIntelFeedId = (typeof THREAT_INTEL_FEEDS)[number];

export const IOC_TYPES = [
  "ipv4",
  "ipv6",
  "domain",
  "url",
  "hash_sha256",
  "hash_md5",
  "email",
  "cve",
  "other",
] as const;

export type IocType = (typeof IOC_TYPES)[number];

export const exploitStatusSchema = z.enum(["unknown", "poc", "active", "kev"]);
export type ExploitStatus = z.infer<typeof exploitStatusSchema>;

export const threatIntelItemSchema = z.object({
  item_id: z.string().uuid(),
  source_feed: z.enum(THREAT_INTEL_FEEDS),
  /** Vendor or fusion confidence for this normalized row (0–1). */
  confidence_0_1: z.number().min(0).max(1),
  observed_at: z.string().datetime(),
  normalized_at: z.string().datetime(),
  ioc_type: z.enum(IOC_TYPES),
  /** Canonical normalized IOC value (lowercased domain/hash, normalized CVE id, etc.). */
  ioc_value: z.string().min(1).max(2048),
  cve_id: z.string().regex(/^CVE-\d{4}-\d+$/i).optional(),
  exploit_status: exploitStatusSchema.optional(),
  title: z.string().max(512).optional(),
  description: z.string().max(16000).optional(),
  tags: z.array(z.string()).default([]),
  /** Pointer to vendor row, bundle URL, or internal blob id — not raw secret material. */
  raw_reference: z.string().min(1).max(2048),
  linked_asset_ids: z.array(z.string().min(1)).default([]),
  linked_finding_ids: z.array(z.string().min(1)).default([]),
});

export type ThreatIntelItem = z.infer<typeof threatIntelItemSchema>;

export const threatIntelIngestionResultSchema = z.object({
  feed_id: z.enum(THREAT_INTEL_FEEDS),
  inserted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  item_ids: z.array(z.string().uuid()),
  errors: z.array(z.string()).default([]),
});

export type ThreatIntelIngestionResult = z.infer<typeof threatIntelIngestionResultSchema>;
