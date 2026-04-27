"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/analyst", label: "Analyst home" },
  { href: "/command-center", label: "Command center" },
  { href: "/findings", label: "Findings" },
  { href: "/incidents", label: "Incidents" },
  { href: "/cves", label: "CVEs" },
  { href: "/scan-runs", label: "Scan runs" },
  { href: "/policy-decisions", label: "Policy decisions" },
  { href: "/approval-requests", label: "Approvals" },
  { href: "/risk-exceptions", label: "Risk exceptions" },
  { href: "/compliance", label: "Compliance" },
  { href: "/account", label: "Account" },
];

/**
 * Preserves `tenantId` in the query string for pages that work like mini-apps with ?tenantId=…
 */
export function AnalystNav() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const tenantId = search.get("tenantId")?.trim() ?? "";
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

  return (
    <nav className="sw-side-nav" aria-label="Analyst console">
      <div className="sw-side-nav__brand">
        <p className="sw-side-nav__eyebrow">SecureWatch360</p>
        <p className="sw-side-nav__title">Security Command Center</p>
      </div>
      <ul className="sw-side-nav__list">
        {NAV_LINKS.map((item) => {
          const isHome = item.href === "/analyst";
          const active = isHome ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={`${item.href}${q}`}
                className={active ? "sw-side-nav__link sw-side-nav__link--active" : "sw-side-nav__link"}
              >
                <span className="sw-side-nav__link-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {tenantId ? (
        <p className="sw-side-nav__meta" title="Active tenant for console views">
          Tenant: <code>{tenantId}</code>
        </p>
      ) : null}
    </nav>
  );
}
