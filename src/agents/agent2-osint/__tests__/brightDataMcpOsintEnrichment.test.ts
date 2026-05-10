import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectBrightDataMcpOsintEnrichment,
  shouldRunBrightDataMcpOsintEnrichment,
} from "../brightDataMcpOsintEnrichment";

const TENANT = "11111111-1111-4111-8111-111111111111";

describe("brightDataMcpOsintEnrichment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs in mock mode without tenant id", async () => {
    vi.stubEnv("BRIGHTDATA_MCP_MOCK", "true");
    vi.stubEnv("BRIGHTDATA_MCP_ENRICHMENT", "");

    expect(shouldRunBrightDataMcpOsintEnrichment({ domain: "example.com" })).toBe(true);

    const events = await collectBrightDataMcpOsintEnrichment({
      domain: "example.com",
      companyName: "Example Corp",
      scanId: "22222222-2222-4222-8222-222222222222",
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.eventType).toBe("bright_data_mcp_intel");
    expect(events[0]!.sourceCategory).toBe("bright_data_mcp");
    expect((events[0]!.raw as { bright_data_mcp?: { trace_id?: string } }).bright_data_mcp?.trace_id).toBeTruthy();
  });

  it("is disabled when BRIGHTDATA_MCP_ENRICHMENT is false", () => {
    vi.stubEnv("BRIGHTDATA_MCP_ENRICHMENT", "false");
    vi.stubEnv("BRIGHTDATA_MCP_MOCK", "");
    expect(shouldRunBrightDataMcpOsintEnrichment({ domain: "example.com", tenantId: TENANT })).toBe(false);
  });

  it("runs when enrichment is explicitly enabled with tenant id", () => {
    vi.stubEnv("BRIGHTDATA_MCP_ENRICHMENT", "true");
    vi.stubEnv("BRIGHTDATA_MCP_MOCK", "");
    expect(shouldRunBrightDataMcpOsintEnrichment({ domain: "example.com", tenantId: TENANT })).toBe(true);
  });
});
