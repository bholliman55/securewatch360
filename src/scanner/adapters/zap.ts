import type { ScanContext, ScannerAdapter } from ".";
import { runProcess } from "./process";

/**
 * OWASP ZAP baseline adapter (web scan).
 * Requires zap-baseline.py available locally or command override.
 */
export const zapScannerAdapter: ScannerAdapter = {
  id: "zap",
  metadata: {
    name: "OWASP ZAP",
    type: "web",
    supportedTargetTypes: ["url", "domain", "webapp"],
    implemented: true,
  },
  async run(ctx: ScanContext) {
    const command = process.env.ZAP_BASELINE_COMMAND || "zap-baseline.py";
    const args = ["-t", ctx.targetValue, "-m", "1"];
    const { stdout } = await runProcess(command, args, { timeoutMs: 180_000 });

    const failNew = Number(/FAIL-NEW:\s*(\d+)/.exec(stdout)?.[1] ?? 0);
    const warnNew = Number(/WARN-NEW:\s*(\d+)/.exec(stdout)?.[1] ?? 0);

    const findings = [];
    if (failNew > 0) {
      findings.push({
        severity: "high",
        category: "web-security",
        title: "ZAP baseline reported failing alerts",
        description: `OWASP ZAP baseline reported ${failNew} failing alert(s).`,
        evidence: {
          targetValue: ctx.targetValue,
          failNew,
          warnNew,
        },
      });
    }

    if (warnNew > 0) {
      findings.push({
        severity: "medium",
        category: "web-security",
        title: "ZAP baseline reported warning alerts",
        description: `OWASP ZAP baseline reported ${warnNew} warning alert(s).`,
        evidence: {
          targetValue: ctx.targetValue,
          failNew,
          warnNew,
        },
      });
    }

    return {
      scanner: "zap",
      scannerName: "OWASP ZAP",
      scannerType: "web",
      findings,
    };
  },
};
