/**
 * /cmmc-demo — SecureWatch360 CMMC Level 2 Compliance Demo.
 *
 * Standalone investor-facing simulation that:
 *   1. Shows the system in full CMMC Level 2 compliance (baseline)
 *   2. Simulates five controls drifting out of compliance
 *   3. Shows SecureWatch360 detecting, reasoning, and auto-remediating each violation
 *   4. Returns the system to full compliance with audit evidence
 *
 * Fully client-side — no DB required. Runs on a timer-driven state machine
 * so it works in air-gapped environments and investor pitches alike.
 */

import { CmmcDemoShell } from "@/components/demo/CmmcDemoShell";

export const metadata = {
  title: "SecureWatch360 — CMMC Level 2 Compliance Demo",
  description:
    "A live simulation of SecureWatch360 detecting CMMC Level 2 control drift and automatically returning a DoD contractor to full compliance — powered by autonomous AI agents.",
};

export default function CmmcDemoPage(): React.JSX.Element {
  return <CmmcDemoShell />;
}
