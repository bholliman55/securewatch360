import type { ThreatIntelFeedAdapter } from "./threatIntelFeed.interface";
import type { ThreatIntelFeedId } from "./threatIntelItem.schema";

function mockAdapter(
  feed_id: ThreatIntelFeedId,
  display_name: string,
  default_confidence_0_1: number,
  records: Record<string, unknown>[],
): ThreatIntelFeedAdapter {
  return {
    feed_id,
    display_name,
    default_confidence_0_1,
    async fetchRaw() {
      return { records: [...records] };
    },
  };
}

/** Deterministic mock rows for unit tests — no network I/O. */
export function createMockCisaKevAdapter(): ThreatIntelFeedAdapter {
  return mockAdapter("cisa_kev", "CISA KEV (mock)", 0.95, [
    {
      cve_id: "CVE-2024-12345",
      exploit_status: "kev",
      observed_at: "2024-06-01T12:00:00.000Z",
      raw_reference: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      title: "Mock KEV entry",
    },
  ]);
}

export function createMockAbuseChAdapter(): ThreatIntelFeedAdapter {
  return mockAdapter("abuse_ch", "abuse.ch (mock)", 0.88, [
    {
      ioc_type: "ipv4",
      ioc_value: "198.51.100.10",
      observed_at: "2024-06-02T15:00:00.000Z",
      raw_reference: "https://sslbl.abuse.ch/mock",
      title: "Malicious SSL IP",
    },
  ]);
}

export function createMockMicrosoftStubAdapter(): ThreatIntelFeedAdapter {
  return mockAdapter("microsoft_threat_intel_stub", "Microsoft threat intel (stub)", 0.5, [
    {
      ioc_type: "hash_sha256",
      ioc_value: "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
      observed_at: "2024-06-03T09:00:00.000Z",
      raw_reference: "stub:microsoft:indicator:1",
    },
  ]);
}
