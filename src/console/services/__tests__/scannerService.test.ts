import { afterEach, describe, expect, it, vi } from "vitest";

import { scannerService } from "../scannerService";
import { apiJson } from "../../lib/apiFetch";

vi.mock("../../lib/apiFetch", () => ({
  apiJson: vi.fn(),
}));

const tenantId = "00000000-0000-4000-8000-000000000001";
const scanId = "00000000-0000-4000-8000-000000000002";

describe("scannerService traceability mapping", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("maps scan source fields from findings responses", async () => {
    vi.mocked(apiJson).mockImplementation((path) => {
      expect(String(path)).toContain("tenantId=");
      return Promise.resolve({
        ok: true,
        findings: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            severity: "high",
            category: "web",
            title: "Missing header",
            description: "Header missing",
            status: "open",
            asset_type: "url",
            exposure: "internet",
            created_at: "2026-05-12T19:00:00.000Z",
            updated_at: "2026-05-12T19:00:00.000Z",
            scan: {
              id: scanId,
              name: "OWASP ZAP",
              type: "web",
              status: "completed",
              date: "2026-05-12T18:55:00.000Z",
              target_name: "Primary Web",
              target_type: "url",
              target_value: "https://example.com",
            },
          },
        ],
      });
    });

    const vulnerabilities = await scannerService.getAllVulnerabilities(50, tenantId);

    expect(vulnerabilities[0]).toMatchObject({
      vulnerability_id: "00000000-0000-4000-8000-000000000003",
      scan_id: scanId,
      scan_name: "OWASP ZAP",
      scan_type: "web",
      scan_status: "completed",
      scan_target: "https://example.com",
    });
  });

  it("filters vulnerabilities by scan id", async () => {
    vi.mocked(apiJson).mockResolvedValue({ ok: true, findings: [] });

    await scannerService.getVulnerabilitiesByScan(scanId, tenantId);

    const lastCall = vi.mocked(apiJson).mock.calls.at(-1);
    expect(String(lastCall?.[0])).toContain(
      `scanRunId=${encodeURIComponent(scanId)}`
    );
  });
});
