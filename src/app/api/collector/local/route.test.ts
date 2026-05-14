import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile } from "fs/promises";
import { GET } from "@/app/api/collector/local/route";

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

const sampleReport = {
  collector_id: "local-dev",
  tenant_id: "local-tenant",
  source_type: "site_collector",
  schema_version: "collector.inventory.v1",
  collected_at: "2026-05-14T04:40:29.270Z",
  host: { hostname: "LAPTOP-TEST" },
  network: { interfaces: [], macAddresses: [] },
  software: { installed: [] },
  processes: { count: 0 },
  ports: { count: 0 },
  errors: [],
};

describe("GET /api/collector/local", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns a collector report when the JSON file exists", async () => {
    const mockedReadFile = vi.mocked(readFile);
    mockedReadFile.mockResolvedValue(JSON.stringify(sampleReport));

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.collector_id).toBe("local-dev");
    expect(body.network).toBeDefined();
  });

  it("returns a 404 when the inventory file is missing", async () => {
    const mockedReadFile = vi.mocked(readFile);
    mockedReadFile.mockRejectedValue(new Error("ENOENT: no such file or directory"));

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toContain("Local collector inventory file not found");
  });

  it("returns a 404 in production mode", async () => {
    process.env.NODE_ENV = "production";

    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toContain("only available in development");
  });
});
