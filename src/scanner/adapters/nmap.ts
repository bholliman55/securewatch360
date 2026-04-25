import type { ScanContext, ScannerAdapter } from ".";
import { runProcess } from "./process";

/**
 * Nmap adapter (network scan). Requires nmap installed or command override.
 */
export const nmapScannerAdapter: ScannerAdapter = {
  id: "nmap",
  metadata: {
    name: "Nmap",
    type: "network",
    supportedTargetTypes: ["ip", "cidr", "hostname", "domain"],
    implemented: true,
  },
  async run(ctx: ScanContext) {
    const command = process.env.NMAP_COMMAND || "nmap";
    const args = ["-Pn", "--open", ctx.targetValue];
    const { stdout } = await runProcess(command, args, { timeoutMs: 90_000 });

    const openPorts = [...stdout.matchAll(/^(\d+)\/tcp\s+open\s+([^\s]+)/gm)].map((m) => ({
      port: Number(m[1]),
      service: m[2],
    }));

    const riskyPorts = openPorts.filter((p) => [21, 23, 445, 3389].includes(p.port));
    const findings = [];

    if (riskyPorts.length > 0) {
      findings.push({
        severity: "high",
        category: "network-exposure",
        title: "Potentially risky network ports are open",
        description: `Nmap identified ${riskyPorts.length} potentially risky open ports.`,
        evidence: {
          targetValue: ctx.targetValue,
          riskyPorts,
          openPortCount: openPorts.length,
        },
      });
    }

    if (openPorts.length > 0) {
      findings.push({
        severity: riskyPorts.length > 0 ? "medium" : "low",
        category: "network-scan",
        title: "Open TCP ports detected",
        description: `Nmap detected ${openPorts.length} open TCP port(s).`,
        evidence: {
          targetValue: ctx.targetValue,
          openPorts,
        },
      });
    }

    return {
      scanner: "nmap",
      scannerName: "Nmap",
      scannerType: "network",
      findings,
    };
  },
};
