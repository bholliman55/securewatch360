import fs from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectInventory } from "../collector";
import { writeInventory, getOutputPath } from "../outputWriter";

const outputPath = getOutputPath();
const fastCollectors = {
  host: vi.fn(async () => ({ hostname: "test-host" })),
  network: vi.fn(async () => ({ interfaces: [], macAddresses: [] })),
  software: vi.fn(async () => ({ installed: [] })),
  processes: vi.fn(async () => ({ count: 0, sample: [] })),
  ports: vi.fn(async () => ({ count: 0, sample: [] })),
};

afterEach(async () => {
  try {
    await fs.promises.rm(outputPath, { force: true });
  } catch {}
  vi.clearAllMocks();
});

describe("site collector", () => {
  it("generates a report with required fields", async () => {
    const report = await collectInventory(fastCollectors);

    expect(report.collector_id).toBe("local-dev");
    expect(report.tenant_id).toBe("local-tenant");
    expect(report.source_type).toBe("site_collector");
    expect(report.schema_version).toBe("collector.inventory.v1");
    expect(report.collected_at).toEqual(expect.any(String));
    expect(report.host).toBeTypeOf("object");
    expect(report.network).toBeTypeOf("object");
    expect(report.software).toBeTypeOf("object");
    expect(report.processes).toBeTypeOf("object");
    expect(report.ports).toBeTypeOf("object");
    expect(report.errors).toBeInstanceOf(Array);
  });

  it("continues collecting when the host section fails", async () => {
    const failingCollectors = {
      ...fastCollectors,
      host: vi.fn(async () => {
        throw new Error("boom");
      }),
    };

    const report = await collectInventory(failingCollectors);

    expect(report.errors.some((message) => message.includes("host collection failed"))).toBe(true);
    expect(report.host).toEqual({});
  });

  it("writes latest-inventory.json to the output folder", async () => {
    const report = await collectInventory(fastCollectors);
    const filePath = await writeInventory(report);

    expect(filePath).toBe(outputPath);
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    expect(parsed.collector_id).toBe("local-dev");
    expect(parsed.host).toBeDefined();
  });
});
