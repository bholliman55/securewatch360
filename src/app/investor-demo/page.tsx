/**
 * /investor-demo — SecureWatch360 Investor Mode landing page.
 *
 * This is a server component that pre-fetches the canonical scenario
 * snapshot so the first paint is informative even before the client shell
 * hydrates. The snapshot is then handed off to `InvestorDemoShell` which
 * subscribes to Supabase realtime and exposes the full set of controls.
 *
 * The page renders correctly even when:
 *   - the demo has not been seeded yet (assets/events/etc. are empty)
 *   - Supabase realtime is unavailable (the client polls /state instead)
 *   - ElevenLabs is not connected (the voice panel shows suggested
 *     commands and the latest spoken_summary, but does not play audio)
 */

import { headers } from "next/headers";

import { InvestorDemoShell } from "@/components/demo/InvestorDemoShell";
import {
  EMPTY_INVESTOR_DEMO_STATE,
  type InvestorDemoState,
} from "@/components/demo/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "SecureWatch360 — Investor Demo Mode",
  description:
    "A controlled, repeatable simulation of SecureWatch360 detecting, reasoning, containing, and reporting a ransomware-precursor incident for an MSP-managed healthcare client.",
};

async function loadInitialState(): Promise<InvestorDemoState> {
  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const protocol =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const url = `${protocol}://${host}/api/demo/investor/state`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return EMPTY_INVESTOR_DEMO_STATE;
    return (await res.json()) as InvestorDemoState;
  } catch {
    return EMPTY_INVESTOR_DEMO_STATE;
  }
}

export default async function InvestorDemoPage(): Promise<React.JSX.Element> {
  const initialState = await loadInitialState();
  return <InvestorDemoShell initialState={initialState} />;
}
