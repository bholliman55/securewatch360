import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { POST } from "@/app/api/runner/heartbeat/route";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("POST /api/runner/heartbeat", () => {
  const prevToken = process.env.SW360_RUNNER_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SW360_RUNNER_TOKEN = "x".repeat(32);
  });

  afterEach(() => {
    process.env.SW360_RUNNER_TOKEN = prevToken;
  });

  it("returns 401 without bearer token", async () => {
    const req = new NextRequest("http://localhost/api/runner/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT, runnerId: "r1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid tenantId", async () => {
    const req = new NextRequest("http://localhost/api/runner/heartbeat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${"x".repeat(32)}`,
      },
      body: JSON.stringify({ tenantId: "not-a-uuid", runnerId: "r1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("upserts heartbeat when token matches", async () => {
    const req = new NextRequest("http://localhost/api/runner/heartbeat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${"x".repeat(32)}`,
      },
      body: JSON.stringify({
        tenantId: TENANT,
        runnerId: "edge-01",
        version: "1.0.0",
        hostName: "host-a",
        capabilities: ["scan"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalled();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.runnerId).toBe("edge-01");
  });
});
