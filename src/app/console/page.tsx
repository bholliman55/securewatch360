/**
 * /console — the SecureWatch360 analyst console.
 *
 * This is a pure client-side page (no server data fetching). All auth and
 * tenant state is managed by the console's own React context tree, which
 * reads the shared Supabase browser client and Next.js middleware session.
 */
import type { Metadata } from "next";
import ConsoleApp from "@/console/App";

export const metadata: Metadata = {
  title: "SecureWatch360 — Console",
};

export default function ConsolePage() {
  return <ConsoleApp />;
}
