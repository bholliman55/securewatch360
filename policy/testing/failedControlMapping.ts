/**
 * Maps failing controls to frameworks and remediation hints for audit trails.
 */

import type { SupportedVerificationFramework } from "./frameworks";
import { FRAMEWORK_DISPLAY_NAME, parseControlKey } from "./frameworks";
import type { ControlPosture } from "./driftDetection";

export type FailedControlRecord = {
  control_key: string;
  framework: SupportedVerificationFramework;
  control_id: string;
  framework_display_name: string;
  posture: ControlPosture;
  remediation_hint: string;
};

const HINTS: Partial<Record<SupportedVerificationFramework, string>> = {
  cmmc: "Review CMMC SSP / POA&M; validate access control implementation.",
  nist: "Align with NIST CSF subcategories; document compensating controls.",
  hipaa: "Trigger HIPAA security rule assessment and workforce training evidence.",
  cis: "Apply CIS remediation recommendations for the failed safeguard.",
  soc2: "Map to SOC 2 CC suite; evidence control operation for auditors.",
  pci_dss: "PCI remediation per SAQ or ROC scope; segment cardholder data where applicable.",
  iso27001: "ISO 27001 Annex A treatment plan and risk register update.",
};

export function mapFailedControls(observed: Record<string, ControlPosture>): FailedControlRecord[] {
  const out: FailedControlRecord[] = [];

  for (const [key, posture] of Object.entries(observed)) {
    if (posture !== "fail" && posture !== "unknown") continue;
    const parsed = parseControlKey(key);
    if (!parsed) continue;

    out.push({
      control_key: key,
      framework: parsed.framework,
      control_id: parsed.controlId,
      framework_display_name: FRAMEWORK_DISPLAY_NAME[parsed.framework],
      posture,
      remediation_hint:
        posture === "unknown"
          ? "Unknown posture — re-run evaluation probe or verify exporter connectivity."
          : (HINTS[parsed.framework] ?? "Review policy binding and remediate per organizational standard."),
    });
  }

  return out.sort((a, b) => a.control_key.localeCompare(b.control_key));
}
