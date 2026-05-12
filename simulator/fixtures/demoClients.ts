/**
 * Fictionally named MSSP-style clients for SecureWatch360 demo rehearsals only.
 * Deterministic UUIDs — never reuse as production tenant identifiers.
 */

export interface DemoClientFixture {
  /** Stable surrogate tenant UUID (demo namespace). */
  id: string;
  /** Kebab-case key for lookups and payloads. */
  slug: string;
  display_name: string;
  /** Narrative-only industry label — not PHI/PII. */
  vertical: string;
  primary_region_stub: string;
  /** Investor-safe one-liner displayed in summaries. */
  demo_tagline: string;
}

/** Four rotating demo portfolios — illustrative only; no linkage to live customers. */
export const DEMO_CLIENT_FIXTURES: readonly DemoClientFixture[] = [
  {
    id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa001",
    slug: "acme-manufacturing-demo",
    display_name: "Acme Manufacturing",
    vertical: "Discrete manufacturing · OT-adjacent",
    primary_region_stub: "US-Midwest (synthetic HQ)",
    demo_tagline: "Multi-site capex-heavy operations with outsourced SOC — classic MSSP uplift story.",
  },
  {
    id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa002",
    slug: "volunteer-health-group-demo",
    display_name: "Volunteer Health Group",
    vertical: "Community health nonprofit",
    primary_region_stub: "Southeast consolidation (fabricated geography)",
    demo_tagline: "Lean IT + grants-driven budget — HIPAA-minded narrative without regulated datasets.",
  },
  {
    id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa003",
    slug: "chattanooga-defense-supply-demo",
    display_name: "Chattanooga Defense Supply",
    vertical: "Defense industrial base supplier (dual-use logistics)",
    primary_region_stub: "Tennessee watershed (fabricated HQ)",
    demo_tagline: "CMMC-style storytelling with synthetic CUI-free evidence only.",
  },
  {
    id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa004",
    slug: "riverbend-dental-partners-demo",
    display_name: "Riverbend Dental Partners",
    vertical: "Multi-clinic dentistry MSO",
    primary_region_stub: "Riverbend metro (fabricated locality)",
    demo_tagline: "Franchised clinical footprint · PCI-lite card-present themes in lab stubs only.",
  },
] as const;

export function demoClientBySlug(slug: string): DemoClientFixture | undefined {
  const k = slug.trim().toLowerCase();
  return DEMO_CLIENT_FIXTURES.find((c) => c.slug === k);
}

/** Deterministic client rotation for repeatable investor demos keyed by scenario id. */
export function pickDemoClientForScenario(scenarioId: string): DemoClientFixture {
  let h = 0;
  for (let i = 0; i < scenarioId.length; i += 1) {
    h = (Math.imul(31, h) + scenarioId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % DEMO_CLIENT_FIXTURES.length;
  return DEMO_CLIENT_FIXTURES[idx]!;
}
