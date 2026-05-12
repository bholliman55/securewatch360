import { BrightDataClient } from "@/integrations/brightdata/brightDataClient";
import { getBrightDataConfig } from "@/integrations/brightdata/brightDataConfig";
import { BrightDataError } from "@/integrations/brightdata/brightDataErrors";
import type { DataAcquisitionProvider } from "./DataAcquisitionProvider";
import type {
  DomainDiscoveryInput,
  OsintCollectionInput,
  VendorSecurityInput,
  ExternalAssetEvent,
  OsintIntelligenceEvent,
} from "./acquisitionTypes";
import { deduplicateAssets, deduplicateOsintEvents, scoreToSeverity, redactCredentials } from "./acquisitionNormalizer";

export class BrightDataAcquisitionProvider implements DataAcquisitionProvider {
  private readonly client: BrightDataClient;

  constructor() {
    this.client = new BrightDataClient(getBrightDataConfig());
  }

  async fetchUrl(url: string) {
    const result = await this.client.fetchUrl(url);
    return { statusCode: result.statusCode, body: result.body, headers: result.headers };
  }

  async discoverDomainAssets(input: DomainDiscoveryInput): Promise<ExternalAssetEvent[]> {
    const { scanId, clientId, domain } = input;
    const discovered: ExternalAssetEvent[] = [];
    const now = new Date();

    const tasks: Promise<ExternalAssetEvent[]>[] = [];

    if (input.includeSubdomains !== false) {
      tasks.push(this._discoverSubdomains(scanId, clientId, domain, now));
    }
    if (input.includePublicEndpoints !== false) {
      tasks.push(this._discoverPublicEndpoints(scanId, clientId, domain, now));
    }
    if (input.includeCertificates !== false) {
      tasks.push(this._discoverCertificates(scanId, clientId, domain, now));
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "fulfilled") discovered.push(...r.value);
    }

    return deduplicateAssets(discovered);
  }

  private async _discoverSubdomains(
    scanId: string, clientId: string | undefined, domain: string, now: Date
  ): Promise<ExternalAssetEvent[]> {
    const assets: ExternalAssetEvent[] = [];

    // Wire: use Bright Data to query Certificate Transparency logs or search operators.
    // e.g. search: "site:*.domain.com" via SERP API
    const ctSearch = await this._safeSearch(`site:*.${domain}`, 20);
    for (const result of ctSearch) {
      try {
        const u = new URL(result.url);
        if (u.hostname.endsWith(`.${domain}`) && u.hostname !== domain) {
          assets.push({
            scanId, clientId, domain,
            assetType: "subdomain",
            assetValue: u.hostname,
            source: "serp_ct_search",
            confidence: 0.75,
            riskHint: undefined,
            discoveredAt: now,
            raw: { title: result.title, url: result.url },
          });
        }
      } catch { /* skip malformed */ }
    }

    // Wire: also query crt.sh for certificate transparency records
    const crtResults = await this._safeSearch(`site:crt.sh "${domain}"`, 10);
    for (const r of crtResults) {
      const subMatch = r.snippet.match(/\*?\.[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g) ?? [];
      for (const sub of subMatch) {
        const clean = sub.replace(/^\*\./, "");
        if (clean.endsWith(domain) && clean !== domain) {
          assets.push({
            scanId, clientId, domain,
            assetType: "subdomain",
            assetValue: clean,
            source: "crt_sh_search",
            confidence: 0.8,
            discoveredAt: now,
            raw: r,
          });
        }
      }
    }

    return assets;
  }

  private async _discoverPublicEndpoints(
    scanId: string, clientId: string | undefined, domain: string, now: Date
  ): Promise<ExternalAssetEvent[]> {
    const assets: ExternalAssetEvent[] = [];

    // Probe well-known public endpoints passively via web search
    const loginPatterns = ["login", "signin", "auth", "sso", "portal", "admin", "dashboard", "wp-admin", "cpanel"];
    const searchResults = await this._safeSearch(
      `site:${domain} (${loginPatterns.slice(0, 4).join(" OR ")})`,
      15
    );

    for (const r of searchResults) {
      const url = r.url.toLowerCase();
      const isLogin = loginPatterns.some((p) => url.includes(p));
      const isAdmin = /admin|cpanel|dashboard|wp-admin/.test(url);
      assets.push({
        scanId, clientId, domain,
        assetType: isAdmin ? "admin_portal" : isLogin ? "login_page" : "url",
        assetValue: r.url,
        source: "serp_endpoint_search",
        confidence: isAdmin ? 0.85 : 0.7,
        riskHint: isAdmin ? "Admin portal exposed publicly" : undefined,
        discoveredAt: now,
        raw: r,
      });
    }

    // Wire: also fetch robots.txt and sitemap.xml for endpoint enumeration
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      try {
        const result = await this.client.fetchUrl(`https://${domain}${path}`);
        if (result.statusCode === 200) {
          assets.push({
            scanId, clientId, domain,
            assetType: "url",
            assetValue: `https://${domain}${path}`,
            source: "direct_probe",
            confidence: 1.0,
            discoveredAt: now,
            raw: { path, statusCode: result.statusCode },
          });
        }
      } catch { /* not reachable or blocked */ }
    }

    return assets;
  }

  private async _discoverCertificates(
    scanId: string, clientId: string | undefined, domain: string, now: Date
  ): Promise<ExternalAssetEvent[]> {
    const assets: ExternalAssetEvent[] = [];

    // Wire: query crt.sh JSON API directly for CT log entries
    // https://crt.sh/?q=%.domain.com&output=json
    try {
      const result = await this.client.fetchUrl(`https://crt.sh/?q=%.${domain}&output=json`);
      if (result.statusCode === 200) {
        const entries = JSON.parse(result.body) as Array<{ name_value: string; issuer_name: string; not_before: string }>;
        for (const entry of entries.slice(0, 50)) {
          for (const name of entry.name_value.split("\n")) {
            const clean = name.replace(/^\*\./, "").trim();
            if (clean && clean.includes(".")) {
              assets.push({
                scanId, clientId, domain,
                assetType: "certificate",
                assetValue: clean,
                source: "crt_sh_api",
                confidence: 0.95,
                discoveredAt: now,
                raw: { issuer: entry.issuer_name, notBefore: entry.not_before },
              });
            }
          }
        }
      }
    } catch { /* crt.sh unavailable */ }

    return assets;
  }

  async collectOsintSignals(input: OsintCollectionInput): Promise<OsintIntelligenceEvent[]> {
    const events: OsintIntelligenceEvent[] = [];
    const tasks: Promise<OsintIntelligenceEvent[]>[] = [
      this.collectCredentialExposureSignals(input.domain),
      this._searchExploitChatter(input),
      this._searchVulnerabilityMentions(input),
    ];

    if (input.companyName) {
      tasks.push(this._searchBreachReferences(input));
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "fulfilled") events.push(...r.value);
    }

    return deduplicateOsintEvents(events);
  }

  async collectCredentialExposureSignals(domain: string): Promise<OsintIntelligenceEvent[]> {
    const events: OsintIntelligenceEvent[] = [];
    const now = new Date();

    // Wire: search paste sites and breach indexes via SERP
    const pasteQueries = [
      `site:pastebin.com "${domain}" password`,
      `site:paste.ee OR site:ghostbin.com "${domain}"`,
    ];

    for (const query of pasteQueries) {
      const results = await this._safeSearch(query, 5);
      for (const r of results) {
        const preview = redactCredentials(r.snippet);
        const severity = scoreToSeverity(0.7, [r.title, r.snippet]);
        events.push({
          domain,
          eventType: "credential_exposure",
          severity,
          confidence: 0.65,
          sourceCategory: "paste_site",
          evidenceUrl: r.url,
          redactedPreview: preview,
          firstSeen: now,
          lastSeen: now,
          raw: { query, title: r.title },
        });
      }
    }

    return events;
  }

  private async _searchExploitChatter(input: OsintCollectionInput): Promise<OsintIntelligenceEvent[]> {
    const events: OsintIntelligenceEvent[] = [];
    const now = new Date();

    // Wire: search exploit databases and forums for domain/company mentions
    const results = await this._safeSearch(
      `"${input.domain}" exploit OR CVE OR vulnerability site:exploit-db.com OR site:nvd.nist.gov`,
      8
    );

    for (const r of results) {
      const isCve = /CVE-\d{4}-\d+/.test(r.title + r.snippet);
      events.push({
        scanId: input.scanId,
        clientId: input.clientId,
        domain: input.domain,
        companyName: input.companyName,
        eventType: isCve ? "vulnerability_mention" : "exploit_chatter",
        severity: scoreToSeverity(0.6, [r.title, r.snippet]),
        confidence: 0.6,
        sourceCategory: "exploit_db",
        evidenceUrl: r.url,
        redactedPreview: r.snippet.slice(0, 300),
        firstSeen: now,
        lastSeen: now,
        raw: r,
      });
    }

    return events;
  }

  private async _searchVulnerabilityMentions(input: OsintCollectionInput): Promise<OsintIntelligenceEvent[]> {
    const events: OsintIntelligenceEvent[] = [];
    const now = new Date();

    const results = await this._safeSearch(`"${input.domain}" vulnerability disclosure OR security advisory`, 5);
    for (const r of results) {
      events.push({
        scanId: input.scanId,
        clientId: input.clientId,
        domain: input.domain,
        companyName: input.companyName,
        eventType: "vulnerability_mention",
        severity: scoreToSeverity(0.55, [r.title, r.snippet]),
        confidence: 0.55,
        sourceCategory: "web_search",
        evidenceUrl: r.url,
        redactedPreview: r.snippet.slice(0, 300),
        firstSeen: now,
        lastSeen: now,
        raw: r,
      });
    }

    return events;
  }

  private async _searchBreachReferences(input: OsintCollectionInput): Promise<OsintIntelligenceEvent[]> {
    const events: OsintIntelligenceEvent[] = [];
    const now = new Date();

    const results = await this._safeSearch(
      `"${input.companyName}" breach OR "data leak" OR "hacked" site:haveibeenpwned.com OR site:dehashed.com`,
      5
    );

    for (const r of results) {
      events.push({
        scanId: input.scanId,
        clientId: input.clientId,
        domain: input.domain,
        companyName: input.companyName,
        eventType: "breach_reference",
        severity: scoreToSeverity(0.75, [r.title, r.snippet]),
        confidence: 0.7,
        sourceCategory: "breach_index",
        evidenceUrl: r.url,
        redactedPreview: redactCredentials(r.snippet.slice(0, 300)),
        firstSeen: now,
        lastSeen: now,
        raw: r,
      });
    }

    return events;
  }

  async collectVendorSecuritySignals(input: VendorSecurityInput): Promise<OsintIntelligenceEvent[]> {
    const events: OsintIntelligenceEvent[] = [];
    const now = new Date();
    const domain = input.domain ?? input.vendorName;

    // Wire: search vendor security advisory pages and CVE databases
    const results = await this._safeSearch(
      `"${input.vendorName}" security advisory OR CVE OR patch site:${input.domain ?? "github.com OR nvd.nist.gov"}`,
      8
    );

    for (const r of results) {
      events.push({
        domain,
        eventType: "vendor_advisory",
        severity: scoreToSeverity(0.6, [r.title, r.snippet]),
        confidence: 0.65,
        sourceCategory: "vendor_advisory",
        evidenceUrl: r.url,
        redactedPreview: r.snippet.slice(0, 300),
        firstSeen: now,
        lastSeen: now,
        raw: r,
      });
    }

    return events;
  }

  private async _safeSearch(query: string, numResults: number) {
    try {
      const result = await this.client.searchWeb({ query, numResults });
      return result.results;
    } catch (err) {
      if (err instanceof BrightDataError) return [];
      throw err;
    }
  }
}
