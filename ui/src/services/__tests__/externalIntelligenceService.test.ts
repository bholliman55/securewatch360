import { describe, expect, it, vi, beforeEach } from "vitest";
import { normalizeExternalScanDomain, triggerExternalIntelligenceScan } from "../externalIntelligenceService";

const apiJsonMock = vi.fn();

vi.mock("../../lib/apiFetch", () => ({
  apiJson: (...args: unknown[]) => apiJsonMock(...args),
}));

describe("externalIntelligenceService", () => {
  beforeEach(() => {
    apiJsonMock.mockReset();
  });

  it("normalizes domains from URLs", () => {
    expect(normalizeExternalScanDomain("https://app.example.com/login")).toBe("app.example.com");
  });

  it("preserves IPv4 addresses", () => {
    expect(normalizeExternalScanDomain("1.2.3.4")).toBe("1.2.3.4");
  });

  it("falls back to lower-case host text", () => {
    expect(normalizeExternalScanDomain("EXAMPLE.COM")).toBe("example.com");
  });

  it("triggers external intelligence endpoint with normalized domain", async () => {
    apiJsonMock.mockResolvedValue({
      success: true,
      scanId: "scan-123",
      triggered: ["agent1", "agent2"],
    });

    const result = await triggerExternalIntelligenceScan({
      tenantId: "tenant-1",
      targetValue: "https://Example.com/path",
    });

    expect(apiJsonMock).toHaveBeenCalledTimes(1);
    const [path, init] = apiJsonMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/security/external-intelligence/run");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.tenantId).toBe("tenant-1");
    expect(body.domain).toBe("example.com");
    expect(body.runAgent1).toBe(true);
    expect(body.runAgent2).toBe(true);
    expect(result.success).toBe(true);
  });
});
