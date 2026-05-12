import { afterEach, describe, expect, it, vi } from "vitest";

import { scannerService } from "../scannerService";

const tenantId = "00000000-0000-4000-8000-000000000001";
const scanId = "00000000-0000-4000-8000-000000000002";

function mockJsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("scannerService traceability mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps scan source fields from findings responses", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      expect(String(input)).toContain("tenantId=");
      return mockJsonResponse({
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
      scan_target: "Primary Web (https://example.com)",
    });
  });

  it("filters vulnerabilities by scan id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      mockJsonResponse({ ok: true, findings: [] })
    );

    await scannerService.getVulnerabilitiesByScan(scanId, tenantId);

    expect(String(fetchMock.mock.calls[0][0])).toContain(`scanRunId=${encodeURIComponent(scanId)}`);
  });
});
