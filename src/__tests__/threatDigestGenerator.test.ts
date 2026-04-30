import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  eq: mockEq,
  gte: mockGte,
  order: mockOrder,
  limit: mockLimit,
});

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateThreatDigest } from "@/lib/threatDigestGenerator";

function mockSupabaseResponse(findings: object[], vendors: object[]) {
  let callCount = 0;
  mockLimit.mockImplementation(() => {
    callCount++;
    return Promise.resolve({ data: callCount === 1 ? findings : vendors, error: null });
  });
}

describe("generateThreatDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns digest with defaults when no findings", async () => {
    mockSupabaseResponse([], []);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"summary":"Stable","recommendedAction":"Monitor"}' }],
    });

    const digest = await generateThreatDigest("tenant-1");

    expect(digest.tenantId).toBe("tenant-1");
    expect(digest.topFindings).toHaveLength(0);
    expect(digest.vendorRiskChanges).toHaveLength(0);
    expect(digest.generatedAt).toBeTruthy();
    expect(digest.period).toContain("–");
    expect(digest.summary).toBe("Stable");
    expect(digest.recommendedAction).toBe("Monitor");
  });

  it("aggregates findings by title+severity and sorts by count", async () => {
    const findings = [
      { title: "SQLi", severity: "critical", status: "open" },
      { title: "SQLi", severity: "critical", status: "open" },
      { title: "XSS", severity: "high", status: "open" },
    ];
    mockSupabaseResponse(findings, []);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"summary":"Two SQLi","recommendedAction":"Patch SQL"}' }],
    });

    const digest = await generateThreatDigest("tenant-1");
    expect(digest.topFindings[0].title).toBe("SQLi");
    expect(digest.topFindings[0].count).toBe(2);
    expect(digest.topFindings[1].title).toBe("XSS");
    expect(digest.topFindings[1].count).toBe(1);
  });

  it("maps vendor assessments to vendorRiskChanges", async () => {
    mockSupabaseResponse([], [
      { vendor_name: "AcmeCorp", risk_tier: "medium", overall_score: 72 },
      { vendor_name: "BetaVendor", risk_tier: "high", overall_score: 45 },
    ]);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"summary":"Two vendors","recommendedAction":"Review high vendor"}' }],
    });

    const digest = await generateThreatDigest("tenant-1");
    expect(digest.vendorRiskChanges).toHaveLength(2);
    expect(digest.vendorRiskChanges[0].vendorName).toBe("AcmeCorp");
    expect(digest.vendorRiskChanges[1].score).toBe(45);
  });

  it("falls back to defaults when Claude returns invalid JSON", async () => {
    mockSupabaseResponse([], []);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Not valid JSON" }],
    });

    const digest = await generateThreatDigest("tenant-1");
    expect(digest.summary).toBe("No critical threats identified this week. Posture is stable.");
    expect(digest.recommendedAction).toContain("monitoring");
  });

  it("falls back to defaults when Claude call throws", async () => {
    mockSupabaseResponse([], []);
    mockCreate.mockRejectedValueOnce(new Error("API unavailable"));

    const digest = await generateThreatDigest("tenant-1");
    expect(digest.summary).toBeTruthy();
    expect(digest.recommendedAction).toBeTruthy();
  });

  it("limits topFindings to top 5", async () => {
    const findings = Array.from({ length: 10 }, (_, i) => ({
      title: `Finding-${i}`,
      severity: "high",
      status: "open",
    }));
    mockSupabaseResponse(findings, []);
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"summary":"Many","recommendedAction":"Review all"}' }],
    });

    const digest = await generateThreatDigest("tenant-1");
    expect(digest.topFindings.length).toBeLessThanOrEqual(5);
  });
});
