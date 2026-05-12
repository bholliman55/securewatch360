import { randomUUID } from "node:crypto";
import type { ExploitStatus, IocType, ThreatIntelFeedId, ThreatIntelItem } from "./threatIntelItem.schema";
import { threatIntelItemSchema } from "./threatIntelItem.schema";

export function normalizeCveId(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  const m = t.match(/^CVE-(\d{4})-(\d+)$/);
  if (!m) return null;
  return `CVE-${m[1]}-${m[2]}`;
}

export function normalizeIpv4(raw: string): string | null {
  const parts = raw.trim().split(".").map((p) => p.trim());
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums.join(".");
}

export function normalizeDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  d = d.replace(/:\d+$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return null;
  return d;
}

export function normalizeSha256(raw: string): string | null {
  const h = raw.trim().toLowerCase().replace(/^sha256:/, "");
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  return h;
}

export function normalizeMd5(raw: string): string | null {
  const h = raw.trim().toLowerCase().replace(/^md5:/, "");
  if (!/^[a-f0-9]{32}$/.test(h)) return null;
  return h;
}

export type NormalizedThreatIntelInput = {
  source_feed: ThreatIntelFeedId;
  confidence_0_1: number;
  observed_at: string;
  ioc_type: IocType;
  ioc_value: string;
  cve_id?: string;
  exploit_status?: ExploitStatus;
  title?: string;
  description?: string;
  tags?: string[];
  raw_reference: string;
};

/**
 * Builds a validated `ThreatIntelItem` from normalized fields.
 */
export function buildThreatIntelItem(input: NormalizedThreatIntelInput): ThreatIntelItem {
  const now = new Date().toISOString();
  return threatIntelItemSchema.parse({
    item_id: randomUUID(),
    source_feed: input.source_feed,
    confidence_0_1: input.confidence_0_1,
    observed_at: input.observed_at,
    normalized_at: now,
    ioc_type: input.ioc_type,
    ioc_value: input.ioc_value,
    cve_id: input.cve_id,
    exploit_status: input.exploit_status,
    title: input.title,
    description: input.description,
    tags: input.tags ?? [],
    raw_reference: input.raw_reference,
    linked_asset_ids: [],
    linked_finding_ids: [],
  });
}

/** Map arbitrary vendor rows (mock-friendly) into normalized inputs. */
export function normalizeVendorRecord(args: {
  feed_id: ThreatIntelFeedId;
  default_confidence_0_1: number;
  record: Record<string, unknown>;
}): NormalizedThreatIntelInput[] {
  const { feed_id, default_confidence_0_1, record } = args;
  const out: NormalizedThreatIntelInput[] = [];
  const obs = typeof record.observed_at === "string" ? record.observed_at : new Date().toISOString();
  const ref = typeof record.raw_reference === "string" ? record.raw_reference : `stub:${feed_id}:${JSON.stringify(record).slice(0, 80)}`;

  if (typeof record.cve_id === "string") {
    const cve = normalizeCveId(record.cve_id);
    if (cve) {
      out.push({
        source_feed: feed_id,
        confidence_0_1: typeof record.confidence === "number" ? (record.confidence as number) : default_confidence_0_1,
        observed_at: obs,
        ioc_type: "cve",
        ioc_value: cve,
        cve_id: cve,
        exploit_status: (record.exploit_status as ExploitStatus) ?? undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        description: typeof record.description === "string" ? record.description : undefined,
        tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
        raw_reference: ref,
      });
    }
  }

  if (typeof record.ioc_type === "string" && typeof record.ioc_value === "string") {
    const t = record.ioc_type as IocType;
    let v = record.ioc_value as string;
    if (t === "ipv4") {
      const ip = normalizeIpv4(v);
      if (ip) v = ip;
    }
    if (t === "domain") {
      const d = normalizeDomain(v);
      if (d) v = d;
    }
    if (t === "hash_sha256") {
      const h = normalizeSha256(v);
      if (h) v = h;
    }
    if (t === "hash_md5") {
      const h = normalizeMd5(v);
      if (h) v = h;
    }
    out.push({
      source_feed: feed_id,
      confidence_0_1: typeof record.confidence === "number" ? (record.confidence as number) : default_confidence_0_1,
      observed_at: obs,
      ioc_type: t,
      ioc_value: v,
      cve_id: typeof record.cve_id === "string" ? normalizeCveId(record.cve_id) ?? undefined : undefined,
      exploit_status: record.exploit_status as ExploitStatus | undefined,
      title: typeof record.title === "string" ? record.title : undefined,
      description: typeof record.description === "string" ? record.description : undefined,
      tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
      raw_reference: ref,
    });
  }

  return out;
}
