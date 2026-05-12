"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AnalystNav } from "./AnalystNav";

/** Routes that render full-screen without the AppChrome sidebar. */
const BARE_PATHS = new Set(["/login", "/signup", "/onboarding", "/mfa/setup", "/mfa/verify"]);

/** Path prefixes that also skip the sidebar (the console has its own nav). */
const BARE_PREFIXES = ["/console"];

type AppChromeProps = {
  children: ReactNode;
};

/**
 * Renders the analyst side navigation for authenticated product routes; auth pages stay minimal.
 * /console has its own TopNav + Sidebar so it is explicitly excluded.
 */
export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname() ?? "/";
  const showNav =
    !BARE_PATHS.has(pathname) &&
    !BARE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Full-screen routes (console, auth pages) render without the shell wrapper
  // so they can own their own layout completely.
  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="sw-app-shell">
      <Suspense fallback={<nav className="sw-side-nav" aria-hidden />}>
        <AnalystNav />
      </Suspense>
      <div className="sw-app-shell__content">{children}</div>
    </div>
  );
}
