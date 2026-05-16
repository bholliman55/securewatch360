import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCAN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TARGET_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const mockExecuteComplianceScan = vi.fn();
const mockWriteAuditLog = vi.fn();
const mockRequireTenantAccess = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [{ id: TARGET_ID }], error: null })),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

vi.mock("@/lib/complianceScan", async () => {
  const actual = await vi.importActual<typeof import("@/lib/complianceScan")>("@/lib/complianceScan");
  return {
    ...actual,
    executeComplianceScan: (...args: unknown[]) => mockExecuteComplianceScan(...args),
  };
});

import { POST } from "@/app/api/scans/compliance/route";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/scans/compliance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/scans/compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantAccess.mockResolvedValue({ ok: true, userId: USER_ID, role: "analyst" });
    mockExecuteComplianceScan.mockResolvedValue({
      scanRunId: SCAN_ID,
      summary: {
        readinessPercentage: 40,
        passedControls: 1,
        failedControls: 1,
        partialControls: 0,
        unknownControls: 1,
        totalControls: 3,
        topGaps: [],
        framework: "soc2",
        frameworkLabel: "SOC 2",
      },
      results: [],
    });
  });

  it("creates a compliance scan for a supported framework", async () => {
    const response = await POST(
      jsonRequest({
        tenantId: TENANT_ID,
        framework: "soc2",
        scope: "tenant",
        scanTargetIds: [TARGET_ID],
      })
    );

    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.scanRunId).toBe(SCAN_ID);
    expect(mockExecuteComplianceScan).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        tenantId: TENANT_ID,
        framework: "soc2",
        scope: "tenant",
        scanTargetIds: [TARGET_ID],
      })
    );
  });

  it("rejects unsupported frameworks", async () => {
    const response = await POST(
      jsonRequest({
        tenantId: TENANT_ID,
        framework: "made_up",
        scope: "tenant",
      })
    );

    expect(response.status).toBe(400);
    expect(mockExecuteComplianceScan).not.toHaveBeenCalled();
  });
});
