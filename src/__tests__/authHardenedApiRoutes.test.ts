import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REMEDIATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const minimalUser = { id: USER_ID } as User;

const syncDb = vi.hoisted(() => ({
  mockSingle: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: syncDb.mockSingle,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: vi.fn(),
}));

vi.mock("@/nl/commandParser", () => ({
  parseCommand: vi.fn(),
}));

vi.mock("@/nl/commandRouter", () => ({
  routeCommand: vi.fn(),
}));

const mockInngestSend = vi.fn();
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

vi.mock("@/lib/integrationHub", () => ({
  syncRemediationToJira: vi.fn(),
  syncRemediationToServiceNow: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import { requireTenantAccess } from "@/lib/tenant-guard";
import { parseCommand } from "@/nl/commandParser";
import { routeCommand } from "@/nl/commandRouter";
import { syncRemediationToJira, syncRemediationToServiceNow } from "@/lib/integrationHub";
import { POST as postNlCommand } from "@/app/api/nl/command/route";
import { POST as postExternalIntel } from "@/app/api/security/external-intelligence/run/route";
import { POST as postIntegrationSync } from "@/app/api/integrations/sync/route";

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/nl/command (auth + tenant guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(requireTenantAccess).mockReset();
    vi.mocked(parseCommand).mockReset();
    vi.mocked(routeCommand).mockReset();
  });

  it("returns 401 when there is no session user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    const res = await postNlCommand(
      jsonRequest("http://localhost/api/nl/command", {
        tenantId: TENANT_ID,
        input: "run a scan",
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when input is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);

    const res = await postNlCommand(
      jsonRequest("http://localhost/api/nl/command", {
        tenantId: TENANT_ID,
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 403 when tenant access is denied", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Insufficient tenant role",
    });

    const res = await postNlCommand(
      jsonRequest("http://localhost/api/nl/command", {
        tenantId: TENANT_ID,
        input: "show compliance for NIST",
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Insufficient");
  });

  it("returns executed when parser, permission, and router succeed", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: true,
      userId: USER_ID,
      role: "analyst",
    });

    const parsed = {
      intent: "run_scan" as const,
      agent: "agent2" as const,
      confidence: 0.95,
      parameters: {},
      requiresApproval: false,
      reason: "test",
    };

    vi.mocked(parseCommand).mockResolvedValueOnce(parsed);
    vi.mocked(routeCommand).mockResolvedValueOnce({
      scanId: "scan-xyz",
      triggeredEvents: ["securewatch/agent2.scan.requested"],
    });

    const res = await postNlCommand(
      jsonRequest("http://localhost/api/nl/command", {
        tenantId: TENANT_ID,
        input: "run a vulnerability scan",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("executed");
    expect(body.scanId).toBe("scan-xyz");
    expect(vi.mocked(routeCommand)).toHaveBeenCalledWith(
      parsed,
      expect.objectContaining({ tenantId: TENANT_ID, actorUserId: USER_ID })
    );
  });
});

describe("POST /api/security/external-intelligence/run (auth + tenant guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue(undefined);
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(requireTenantAccess).mockReset();
  });

  it("returns 401 when there is no session user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    const res = await postExternalIntel(
      jsonRequest("http://localhost/api/security/external-intelligence/run", {
        tenantId: TENANT_ID,
        domain: "example.com",
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 for private-domain targets once tenant checks pass", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: true,
      userId: USER_ID,
      role: "analyst",
    });

    const res = await postExternalIntel(
      jsonRequest("http://localhost/api/security/external-intelligence/run", {
        tenantId: TENANT_ID,
        domain: "localhost",
      })
    );

    expect(res.status).toBe(400);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant access fails", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "User is not a member of this tenant",
    });

    const res = await postExternalIntel(
      jsonRequest("http://localhost/api/security/external-intelligence/run", {
        tenantId: TENANT_ID,
        domain: "example.com",
      })
    );

    expect(res.status).toBe(403);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("returns 200 and forwards events when guard passes", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: true,
      userId: USER_ID,
      role: "admin",
    });

    const res = await postExternalIntel(
      jsonRequest("http://localhost/api/security/external-intelligence/run", {
        tenantId: TENANT_ID,
        domain: "https://vendor.example.org",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.triggered).toEqual(["agent1", "agent2"]);
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const events = mockInngestSend.mock.calls[0][0] as { name: string }[];
    expect(events.some((e) => e.name === "securewatch/agent1.external_discovery.requested")).toBe(true);
    expect(events.some((e) => e.name === "securewatch/agent2.osint_collection.requested")).toBe(true);
  });

  it("returns 500 when Inngest send fails", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser);
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: true,
      userId: USER_ID,
      role: "admin",
    });
    mockInngestSend.mockRejectedValueOnce(new Error("upstream"));

    const res = await postExternalIntel(
      jsonRequest("http://localhost/api/security/external-intelligence/run", {
        tenantId: TENANT_ID,
        domain: "example.net",
      })
    );

    expect(res.status).toBe(500);
  });
});

describe("POST /api/integrations/sync (tenant guard + mutation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTenantAccess).mockResolvedValue({
      ok: true,
      userId: USER_ID,
      role: "analyst",
    });
    syncDb.mockSingle.mockResolvedValue({
      data: { id: REMEDIATION_ID, title: "Patch CVE", description: "Apply vendor fix" },
      error: null,
    });
    vi.mocked(syncRemediationToJira).mockResolvedValue({ success: true, externalId: "JIRA-1" });
    vi.mocked(syncRemediationToServiceNow).mockResolvedValue({ success: true, externalId: "INC01" });
  });

  it("returns 400 when remediationActionId is missing", async () => {
    const res = await postIntegrationSync(
      jsonRequest("http://localhost/api/integrations/sync", {
        tenantId: TENANT_ID,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when tenant role is insufficient", async () => {
    vi.mocked(requireTenantAccess).mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Insufficient tenant role",
    });

    const res = await postIntegrationSync(
      jsonRequest("http://localhost/api/integrations/sync", {
        tenantId: TENANT_ID,
        remediationActionId: REMEDIATION_ID,
      })
    );

    expect(res.status).toBe(403);
    expect(syncRemediationToJira).not.toHaveBeenCalled();
  });

  it("returns 404 when remediation row is not in tenant scope", async () => {
    syncDb.mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await postIntegrationSync(
      jsonRequest("http://localhost/api/integrations/sync", {
        tenantId: TENANT_ID,
        remediationActionId: REMEDIATION_ID,
      })
    );

    expect(res.status).toBe(404);
  });

  it("syncs to Jira by default when guard passes", async () => {
    const res = await postIntegrationSync(
      jsonRequest("http://localhost/api/integrations/sync", {
        tenantId: TENANT_ID,
        remediationActionId: REMEDIATION_ID,
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(syncRemediationToJira).toHaveBeenCalledWith(
      TENANT_ID,
      REMEDIATION_ID,
      "Patch CVE",
      "Apply vendor fix"
    );
    expect(syncRemediationToServiceNow).not.toHaveBeenCalled();
  });

  it("syncs to ServiceNow when integration is servicenow", async () => {
    const res = await postIntegrationSync(
      jsonRequest("http://localhost/api/integrations/sync", {
        tenantId: TENANT_ID,
        remediationActionId: REMEDIATION_ID,
        integration: "servicenow",
      })
    );

    expect(res.status).toBe(200);
    expect(syncRemediationToServiceNow).toHaveBeenCalled();
    expect(syncRemediationToJira).not.toHaveBeenCalled();
  });

  it("returns 502 when downstream sync fails", async () => {
    vi.mocked(syncRemediationToJira).mockResolvedValueOnce({
      success: false,
      externalId: "",
      error: "Jira unreachable",
    });

    const res = await postIntegrationSync(
      jsonRequest("http://localhost/api/integrations/sync", {
        tenantId: TENANT_ID,
        remediationActionId: REMEDIATION_ID,
      })
    );

    expect(res.status).toBe(502);
  });
});
