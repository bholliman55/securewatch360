import { getSupabaseAdminClient } from "@/lib/supabase";

const KEV_JSON =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

type KevFile = { vulnerabilities?: Array<{ cveID?: string }> };

let kevSetCache: { at: number; set: Set<string> } | null = null;
const KEV_TTL_MS = 1000 * 60 * 60 * 6; // 6h

function normalizeCve(id: string): string {
  return id.trim().toUpperCase();
}

/**
 * CISA KEV cveID set, cached a few hours.
 */
export async function loadCisaKevCveIdSet(): Promise<Set<string>> {
  if (kevSetCache && Date.now() - kevSetCache.at < KEV_TTL_MS) {
    return kevSetCache.set;
  }
  const res = await fetch(KEV_JSON);
  if (!res.ok) {
    throw new Error(`KEV feed HTTP ${res.status}`);
  }
  const data = (await res.json()) as KevFile;
  const set = new Set<string>();
  for (const row of data.vulnerabilities ?? []) {
    const c = row.cveID;
    if (typeof c === "string" && c.length > 0) set.add(normalizeCve(c));
  }
  kevSetCache = { at: Date.now(), set };
  return set;
}

type EpssRow = { epss?: string; percentile?: string };

type EpssResponse = { data?: EpssRow[] };

/**
 * First.org EPSS single-CVE (public, rate-limited; caller should throttle).
 */
export async function fetchEpss(cveId: string): Promise<{ epss: number | null; percentile: number | null }> {
  const id = encodeURIComponent(normalizeCve(cveId));
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);
  const res = await fetch(`https://api.first.org/data/v1/epss?cve=${id}`, { signal: controller.signal });
  clearTimeout(t);
  if (!res.ok) {
    return { epss: null, percentile: null };
  }
  const j = (await res.json()) as EpssResponse;
  const row = j.data?.[0];
  if (!row) {
    return { epss: null, percentile: null };
  }
  const ep = row.epss != null ? Number.parseFloat(String(row.epss)) : null;
  const p = row.percentile != null ? Number.parseFloat(String(row.percentile)) : null;
  return {
    epss: Number.isFinite(ep) ? ep! : null,
    percentile: Number.isFinite(p) ? p! : null,
  };
}

export function computePriorityTier(
  kev: boolean,
  epssPercentile: number | null
): number {
  if (kev) return 1;
  if (epssPercentile != null) {
    if (epssPercentile >= 0.97) return 2;
    if (epssPercentile >= 0.9) return 3;
    if (epssPercentile >= 0.5) return 4;
  }
  return 5;
}

export type EnrichResult = { cveId: string; ok: boolean; error?: string };

/**
 * Updates one `cve_catalog` row with KEV+EPSS and `priority_tier`.
 */
export async function enrichCveInCatalog(
  cveId: string,
  options: { kevSet: Set<string>; delayMsBetweenEpss: number; index: number }
): Promise<EnrichResult> {
  const cve = normalizeCve(cveId);
  const supabase = getSupabaseAdminClient();
  const kev = options.kevSet.has(cve);
  if (options.index > 0) {
    await new Promise((r) => setTimeout(r, options.index * options.delayMsBetweenEpss));
  }
  const ep = kev
    ? { epss: null, percentile: null as number | null }
    : await fetchEpss(cve);
  const tier = computePriorityTier(kev, ep.percentile);
  const now = new Date().toISOString();

  const patch = {
    kev_cisa: kev,
    epss_score: ep.epss,
    epss_percentile: ep.percentile,
    priority_tier: tier,
    enriched_at: now,
    updated_at: now,
  };

  const { data: up, error: upError } = await supabase
    .from("cve_catalog")
    .update(patch)
    .eq("id", cve)
    .select("id");

  if (upError) {
    return { cveId: cve, ok: false, error: upError.message };
  }
  if (!up?.length) {
    const { error: ins } = await supabase.from("cve_catalog").insert({
      id: cve,
      source: "enrichment",
      first_seen_at: now,
      last_seen_at: now,
      ...patch,
    });
    if (ins) {
      return { cveId: cve, ok: false, error: ins.message };
    }
  }
  return { cveId: cve, ok: true };
}
