"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AnalystNav } from "./AnalystNav";

const BARE_PATHS = new Set(["/login", "/signup"]);

type AppChromeProps = {
  children: ReactNode;
};

/**
 * Renders the analyst side navigation for authenticated product routes; auth pages stay minimal.
 */
export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname() ?? "/";
  const showNav = !BARE_PATHS.has(pathname);

  return (
    <div className="sw-app-shell">
      {showNav ? (
        <Suspense fallback={<nav className="sw-side-nav" aria-hidden />}>
          <AnalystNav />
        </Suspense>
      ) : null}
      <div className="sw-app-shell__content">{children}</div>
    </div>
  );
}
