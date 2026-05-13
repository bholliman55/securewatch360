/**
 * /console — the SecureWatch360 analyst console.
 *
 * Pure client-side page. force-dynamic prevents build-time static
 * prerendering which would fail when NEXT_PUBLIC_SUPABASE_URL is not set
 * in the build environment.
 */
import type { Metadata } from "next";
import ConsoleApp from "@/console/App";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SecureWatch360 — Console",
};

export default function ConsolePage() {
  return <ConsoleApp />;
}
