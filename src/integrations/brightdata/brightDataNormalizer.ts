/**
 * Normalizes Bright Data MCP / SERP / scrape payloads into SecureWatch360 threat intelligence signals.
 */

import type { Sw360ThreatIntelSignal } from "./brightDataSw360Schemas";

function isoNow(): string {
  return new Date().toISOString();
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function organicFromSearch(raw: unknown): Array<{ title?: string; link?: string; url?: string; snippet?: string }> {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const organic = root.organic ?? root.organic_results ?? root.results;
  if (!Array.isArray(organic)) return [];
  return organic.filter((x) => x && typeof x === "object") as Array<{
    title?: string;
    link?: string;
    url?: string;
    snippet?: string;
  }>;
}

/** Map SERP-style MCP search output to normalized OSINT / news-style signals. */
export function normalizeSearchResultsToSignals(
  raw: unknown,
  ctx: {
    tenant_id: string;
    trace_id: string;
    correlation_id: string;
    query: string;
    signal_type?: Sw360ThreatIntelSignal["signal_type"];
  },
): Sw360ThreatIntelSignal[] {
  const rows = organicFromSearch(raw);
  const collected_at = isoNow();
  const out: Sw360ThreatIntelSignal[] = [];
  let idx = 0;
  for (const row of rows) {
    idx += 1;
    const url = typeof row.link === "string" ? row.link : typeof row.url === "string" ? row.url : undefined;
    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : url ?? `Search hit ${idx}`;
    const summary =
      typeof row.snippet === "string" && row.snippet.trim()
        ? row.snippet.trim()
        : `Public web result for query "${ctx.query}".`;

    const positionBoost = Math.max(0, 0.15 - idx * 0.02);
    const confidence_score = clamp01(0.55 + positionBoost);

    out.push({
      signal_type: ctx.signal_type ?? "web_search_hit",
      title,
      summary,
      tenant_id: ctx.tenant_id,
      trace_id: ctx.trace_id,
      correlation_id: ctx.correlation_id,
      source_url: url,
      collected_at,
      confidence_score,
      provider: "bright_data_mcp",
      metadata: {
        query: ctx.query,
        position: idx,
        raw_preview: row,
      },
    });
  }
  return out;
}

/** Map scrape-as-markdown MCP output to a single structured intel signal. */
export function normalizeScrapeToSignal(
  raw: unknown,
  ctx: {
    tenant_id: string;
    trace_id: string;
    correlation_id: string;
    source_url: string;
  },
): Sw360ThreatIntelSignal {
  let summary = "Scraped public page content (normalized).";
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.markdown === "string" && o.markdown.trim()) {
      summary = o.markdown.trim().slice(0, 2000);
    } else if (typeof o.content === "string") {
      summary = o.content.trim().slice(0, 2000);
    }
  }

  return {
    signal_type: "scraped_page_summary",
    title: `Public page capture: ${ctx.source_url}`,
    summary,
    tenant_id: ctx.tenant_id,
    trace_id: ctx.trace_id,
    correlation_id: ctx.correlation_id,
    source_url: ctx.source_url,
    collected_at: isoNow(),
    confidence_score: 0.72,
    provider: "bright_data_mcp",
    metadata: { raw_type: typeof raw },
  };
}

export function normalizeScreenshotToSignal(
  raw: unknown,
  ctx: {
    tenant_id: string;
    trace_id: string;
    correlation_id: string;
    source_url: string;
  },
): Sw360ThreatIntelSignal {
  const meta: Record<string, unknown> = {};
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.image_base64 === "string") {
      meta.screenshot_base64_length = o.image_base64.length;
    }
    if (typeof o.note === "string") meta.note = o.note;
  }
  return {
    signal_type: "screenshot_capture",
    title: `Screenshot evidence: ${ctx.source_url}`,
    summary: "Visual capture of a public page (metadata only in this normalized view).",
    tenant_id: ctx.tenant_id,
    trace_id: ctx.trace_id,
    correlation_id: ctx.correlation_id,
    source_url: ctx.source_url,
    collected_at: isoNow(),
    confidence_score: 0.85,
    provider: "bright_data_mcp",
    metadata: meta,
  };
}

/** Heuristic classification for breach / news style hits from titles and snippets. */
export function refineSignalTypesForNewsAndBreach(signals: Sw360ThreatIntelSignal[]): Sw360ThreatIntelSignal[] {
  const breachRe = /\b(breach|leaked|credential dump|pwned|stealer log)\b/i;
  const newsRe = /\b(news|report|announces|discloses|sec advisory)\b/i;
  return signals.map((s) => {
    const blob = `${s.title}\n${s.summary}`;
    if (breachRe.test(blob)) {
      return { ...s, signal_type: "breach_mention" as const };
    }
    if (newsRe.test(blob)) {
      return { ...s, signal_type: "news_mention" as const };
    }
    return s;
  });
}
