import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing the module under test
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, single: mockSingle });
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  upsert: mockUpsert,
});
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import {
  syncRemediationToJira,
  syncRemediationToServiceNow,
  getIntegrationConfig,
} from "@/lib/integrationHub";

const JIRA_CONFIG = {
  id: "cfg-1",
  tenant_id: "tenant-a",
  integration_type: "jira" as const,
  enabled: true,
  last_sync_at: null,
  config: {
    baseUrl: "https://example.atlassian.net",
    projectKey: "SEC",
    email: "user@example.com",
    apiToken: "tok123",
  },
};

const SNOW_CONFIG = {
  id: "cfg-2",
  tenant_id: "tenant-a",
  integration_type: "servicenow" as const,
  enabled: true,
  last_sync_at: null,
  config: {
    instanceUrl: "https://dev12345.service-now.com",
    username: "admin",
    password: "pass",
  },
};

describe("getIntegrationConfig", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no config found", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getIntegrationConfig("tenant-a", "jira");
    expect(result).toBeNull();
  });

  it("returns config when found", async () => {
    mockSingle.mockResolvedValueOnce({ data: JIRA_CONFIG, error: null });
    const result = await getIntegrationConfig("tenant-a", "jira");
    expect(result?.integration_type).toBe("jira");
  });
});

describe("syncRemediationToJira", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns error when Jira not configured", async () => {
    mockSingle.mockResolvedValueOnce({ data: null });
    const result = await syncRemediationToJira("tenant-a", "rem-1", "Title", "Desc");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("creates Jira issue and returns externalId", async () => {
    mockSingle.mockResolvedValueOnce({ data: JIRA_CONFIG });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "10001", key: "SEC-42", self: "https://example.atlassian.net/rest/api/3/issue/10001" }),
    });

    const result = await syncRemediationToJira("tenant-a", "rem-1", "SQL Injection", "Detailed desc");
    expect(result.success).toBe(true);
    expect(result.externalId).toBe("SEC-42");
    expect(result.externalUrl).toContain("SEC-42");
  });

  it("returns error on Jira API failure", async () => {
    mockSingle.mockResolvedValueOnce({ data: JIRA_CONFIG });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errorMessages: ["Project not found"] }),
    });

    const result = await syncRemediationToJira("tenant-a", "rem-1", "Title", "Desc");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Project not found");
  });

  it("upserts sync record with correct conflict key", async () => {
    mockSingle.mockResolvedValueOnce({ data: JIRA_CONFIG });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "10001", key: "SEC-1", self: "" }),
    });

    await syncRemediationToJira("tenant-a", "rem-1", "Title", "Desc");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ integration_type: "jira", local_resource_id: "rem-1" }),
      { onConflict: "tenant_id,integration_type,local_resource_id" }
    );
  });
});

describe("syncRemediationToServiceNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns error when ServiceNow not configured", async () => {
    mockSingle.mockResolvedValueOnce({ data: null });
    const result = await syncRemediationToServiceNow("tenant-a", "rem-1", "Title", "Desc");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("creates ServiceNow incident and returns ticket number", async () => {
    mockSingle.mockResolvedValueOnce({ data: SNOW_CONFIG });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { sys_id: "abc123", number: "INC0001234" } }),
    });

    const result = await syncRemediationToServiceNow("tenant-a", "rem-1", "Title", "Desc");
    expect(result.success).toBe(true);
    expect(result.externalId).toBe("INC0001234");
    expect(result.externalUrl).toContain("INC0001234");
  });

  it("returns error on ServiceNow API failure", async () => {
    mockSingle.mockResolvedValueOnce({ data: SNOW_CONFIG });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });

    const result = await syncRemediationToServiceNow("tenant-a", "rem-1", "Title", "Desc");
    expect(result.success).toBe(false);
    expect(result.error).toContain("ServiceNow API error");
  });
});
