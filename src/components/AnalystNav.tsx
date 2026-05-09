"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./AnalystNav.module.css";

const NAV_LINKS: { href: string; label: string; group?: string }[] = [
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
  { href: "/investor-demo", label: "▶ Ransomware Demo", group: "demos" },
  { href: "/cmmc-demo", label: "▶ CMMC Demo", group: "demos" },
];

interface Tenant {
  id: string;
  name: string;
  role: string;
}

function TenantSelector({ currentTenantId }: { currentTenantId: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data: { ok: boolean; tenants?: Tenant[] }) => {
        if (data.ok && Array.isArray(data.tenants)) {
          setTenants(data.tenants);
        }
      })
      .catch(() => {/* ignore — user may not be authed yet */})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tid = e.target.value;
    if (tid) {
      router.replace(`${pathname}?tenantId=${encodeURIComponent(tid)}`);
    }
  };

  const hasCurrent = tenants.some((t) => t.id === currentTenantId);

  return (
    <div className={styles.tenantSection}>
      <label className={styles.tenantLabel} htmlFor="tenant-select">
        Active Tenant
      </label>
      {loading ? (
        <p className={styles.tenantLoading}>Loading…</p>
      ) : tenants.length === 0 ? (
        <p className={styles.tenantEmpty}>No tenants found</p>
      ) : (
        <>
          <select
            id="tenant-select"
            className={styles.tenantSelect}
            value={hasCurrent ? currentTenantId : ""}
            onChange={handleChange}
          >
            {!hasCurrent && (
              <option value="" disabled>
                — select tenant —
              </option>
            )}
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.role})
              </option>
            ))}
          </select>
          {currentTenantId && !hasCurrent && (
            <p className={styles.tenantNoMatch}>
              Current tenant not in your membership list.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Preserves `tenantId` in the query string for pages that work like
 * mini-apps with ?tenantId=…
 */
export function AnalystNav() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const tenantId = search.get("tenantId")?.trim() ?? "";
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";

  return (
    <nav className="sw-side-nav" aria-label="Analyst console">
      <div className="sw-side-nav__brand">
        <Image
          src="/logo.png"
          alt="SecureWatch360"
          width={160}
          height={86}
          priority
          className={styles.logo}
        />
        <p className="sw-side-nav__eyebrow">SecureWatch360</p>
        <p className="sw-side-nav__title">Security Command Center</p>
      </div>

      <ul className="sw-side-nav__list">
        {NAV_LINKS.map((item, idx) => {
          const isHome = item.href === "/analyst";
          const active =
            isHome
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const prevItem = NAV_LINKS[idx - 1];
          const showGroupSep =
            item.group === "demos" && prevItem?.group !== "demos";
          return (
            <li key={item.href}>
              {showGroupSep && (
                <div className={styles.groupSep}>Investor Demos</div>
              )}
              <Link
                href={`${item.href}${q}`}
                className={
                  active
                    ? "sw-side-nav__link sw-side-nav__link--active"
                    : "sw-side-nav__link"
                }
              >
                <span className="sw-side-nav__link-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <TenantSelector currentTenantId={tenantId} />

      <SignOutButton />
    </nav>
  );
}

function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className={styles.signOutSection}>
      <button
        className={styles.signOutBtn}
        onClick={handleSignOut}
        disabled={loading}
      >
        {loading ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
