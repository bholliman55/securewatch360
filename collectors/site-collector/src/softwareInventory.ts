import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function collectInstalledSoftware(): Promise<Record<string, unknown>> {
  if (process.platform === "win32") {
    try {
      const command = `powershell.exe -NoProfile -NoLogo -Command "Get-ItemProperty -Path HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*,HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate | Sort-Object DisplayName | ConvertTo-Json -Depth 3"`;
      const { stdout } = await execAsync(command, {
        timeout: 20000,
        maxBuffer: 10 * 1024 * 1024,
        shell: "cmd.exe",
      });

      const parsed = JSON.parse(stdout.trim() || "[]");
      const items = Array.isArray(parsed) ? parsed : [parsed];

      return {
        installed: items.map((entry) => ({
          name: entry.DisplayName ?? "",
          version: entry.DisplayVersion ?? "",
          publisher: entry.Publisher ?? "",
          installDate: entry.InstallDate ?? "",
        })),
      };
    } catch (error) {
      return {
        installed: [],
        note: "Windows software inventory failed",
        softwareError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    installed: [],
    note: "installed software collection is only implemented for Windows in this MVP",
  };
}
