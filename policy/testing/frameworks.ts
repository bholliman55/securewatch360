/**
 * Supported compliance frameworks for policy-as-code verification (aligns with `POLICY_FRAMEWORKS` in src).
 */

import type { PolicyFramework } from "@/types/policy";

export type SupportedVerificationFramework =
  | "cmmc"
  | "nist"
  | "hipaa"
  | "cis"
  | "soc2"
  | "pci_dss"
  | "iso27001";

export const VERIFICATION_FRAMEWORK_ORDER: SupportedVerificationFramework[] = [
  "cmmc",
  "nist",
  "hipaa",
  "cis",
  "soc2",
  "pci_dss",
  "iso27001",
];

/** Display names for reports */
export const FRAMEWORK_DISPLAY_NAME: Record<SupportedVerificationFramework, string> = {
  cmmc: "CMMC",
  nist: "NIST CSF 2.0",
  hipaa: "HIPAA",
  cis: "CIS Controls v8",
  soc2: "SOC 2",
  pci_dss: "PCI-DSS",
  iso27001: "ISO 27001",
};

/** Representative control IDs per framework for coverage denominators (documentation anchors — extend per tenant catalogs). */
export const REPRESENTATIVE_CONTROL_CATALOG: Record<SupportedVerificationFramework, string[]> = {
  cmmc: ["AC.L1-3.1.1", "AC.L1-3.1.2", "AU.L2-3.3.1", "IA.L1-3.5.1", "SI.L1-3.14.1"],
  nist: ["GV.OC-01", "ID.AM-01", "PR.AC-01", "DE.CM-01", "RS.MA-01"],
  hipaa: ["164.308(a)(1)", "164.312(a)(1)", "164.312(e)(1)", "164.308(a)(5)"],
  cis: ["1.1", "2.3", "4.2", "7.3", "13.5"],
  soc2: ["CC6.1", "CC6.2", "CC6.6", "CC7.1", "CC7.2"],
  pci_dss: ["1.1.1", "2.1", "3.4", "6.2.4", "8.2.1"],
  iso27001: ["A.5.1", "A.8.1", "A.8.2", "A.12.1", "A.16.1"],
};

export function isSupportedVerificationFramework(
  v: string
): v is SupportedVerificationFramework {
  return (VERIFICATION_FRAMEWORK_ORDER as readonly string[]).includes(v);
}

export function toPolicyFramework(fw: SupportedVerificationFramework): PolicyFramework {
  return fw;
}

export function controlKey(framework: SupportedVerificationFramework, controlId: string): string {
  return `${framework}:${controlId}`;
}

export function parseControlKey(
  key: string
): { framework: SupportedVerificationFramework; controlId: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const framework = key.slice(0, idx);
  const controlId = key.slice(idx + 1);
  if (!isSupportedVerificationFramework(framework) || !controlId) return null;
  return { framework, controlId };
}
