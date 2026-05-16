import { exec } from "child_process";
import { promisify } from "util";
import { InventoryReport } from "./types";
import { collectSystemInventory } from "./systemInventory";
import { collectNetworkInventory } from "./networkInventory";
import { collectInstalledSoftware } from "./softwareInventory";

const execAsync = promisify(exec);

type InventoryCollectors = {
  host: () => Promise<Record<string, unknown>>;
  network: () => Promise<Record<string, unknown>>;
  software: () => Promise<Record<string, unknown>>;
  processes: () => Promise<Record<string, unknown>>;
  ports: () => Promise<Record<string, unknown>>;
};

async function safeCollect<T>(fn: () => Promise<T>, sectionName: string, errors: string[]): Promise<T | Record<string, never>> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${sectionName} collection failed: ${message}`);
    return {};
  }
}

export async function collectProcessSummary(): Promise<Record<string, unknown>> {
  if (process.platform === "win32") {
    const { stdout } = await execAsync("tasklist /FO CSV /NH", {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      shell: "cmd.exe",
    });

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const processes = lines.map((line) => {
      const fields = line.split('","').map((field) => field.replace(/^"|"$/g, ""));
      return {
        name: fields[0] ?? "<unknown>",
        pid: fields[1] ? Number(fields[1]) : undefined,
        sessionName: fields[2] ?? "",
        memoryUsage: fields[4] ?? "",
      };
    });

    return {
      count: processes.length,
      sample: processes.slice(0, 20),
    };
  }

  return {
    count: 0,
    sample: [],
    note: "process summary is only implemented for Windows in this MVP",
  };
}

export async function collectPortSummary(): Promise<Record<string, unknown>> {
  if (process.platform === "win32") {
    const { stdout } = await execAsync("netstat -ano | findstr LISTENING", {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      shell: "cmd.exe",
    });

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const ports = lines.map((line) => {
      const parts = line.split(/\s+/);
      return {
        protocol: parts[0] ?? "",
        localAddress: parts[1] ?? "",
        state: parts[3] ?? "LISTENING",
        pid: parts[4] ? Number(parts[4]) : undefined,
      };
    });

    return {
      count: ports.length,
      sample: ports.slice(0, 20),
    };
  }

  return {
    count: 0,
    sample: [],
    note: "listening ports are only implemented for Windows in this MVP",
  };
}

const defaultCollectors: InventoryCollectors = {
  host: collectSystemInventory,
  network: collectNetworkInventory,
  software: collectInstalledSoftware,
  processes: collectProcessSummary,
  ports: collectPortSummary,
};

export async function collectInventory(
  collectors: Partial<InventoryCollectors> = {}
): Promise<InventoryReport> {
  const errors: string[] = [];
  const activeCollectors = { ...defaultCollectors, ...collectors };

  const host = await safeCollect(activeCollectors.host, "host", errors);
  const network = await safeCollect(activeCollectors.network, "network", errors);
  const software = await safeCollect(activeCollectors.software, "software", errors);
  const processes = await safeCollect(activeCollectors.processes, "processes", errors);
  const ports = await safeCollect(activeCollectors.ports, "ports", errors);

  return {
    collector_id: "local-dev",
    tenant_id: "local-tenant",
    source_type: "site_collector",
    schema_version: "collector.inventory.v1",
    collected_at: new Date().toISOString(),
    host,
    network,
    software,
    processes,
    ports,
    errors,
  };
}
