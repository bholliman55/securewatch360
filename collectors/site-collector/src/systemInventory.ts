import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function collectSystemInventory(): Promise<Record<string, unknown>> {
  const cpus = os.cpus() ?? [];
  const firstCpu = cpus[0];

  const inventory: Record<string, unknown> = {
    hostname: os.hostname(),
    osType: os.type(),
    platform: os.platform(),
    osRelease: os.release(),
    arch: os.arch(),
    cpuCount: cpus.length,
    cpuModel: firstCpu?.model ?? "unknown",
    cpuSpeedMHz: firstCpu?.speed ?? 0,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    uptimeSeconds: Math.floor(os.uptime()),
  };

  try {
    inventory.disk = await collectDiskInfo();
  } catch (error) {
    inventory.disk = [];
    inventory.diskError = error instanceof Error ? error.message : String(error);
  }

  return inventory;
}

async function collectDiskInfo(): Promise<Array<Record<string, unknown>>> {
  if (process.platform === "win32") {
    const { stdout } = await execAsync("wmic logicaldisk get Caption,FreeSpace,Size /format:csv", {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      shell: "cmd.exe",
    });

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("Node"));

    return lines.map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      return {
        drive: parts[1] ?? "",
        freeBytes: Number(parts[2] ?? 0),
        totalBytes: Number(parts[3] ?? 0),
      };
    });
  }

  return [
    {
      note: "disk inventory is only implemented for Windows in this MVP",
    },
  ];
}
