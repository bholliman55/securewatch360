"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./auth.module.css";

type MeResponse = {
  ok: boolean;
  tenants?: { id: string; name: string; role: string }[];
};

/** Pick the highest-privileged tenant for the initial dashboard redirect. */
function pickBestTenantId(tenants: { id: string; role: string }[]): string {
  const rank: Record<string, number> = { owner: 4, admin: 3, analyst: 2, viewer: 1 };
  return [...tenants].sort((a, b) => (rank[b.role] ?? 0) - (rank[a.role] ?? 0))[0].id;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Keep error messages generic to avoid user enumeration.
        setError("Invalid email or password.");
        return;
      }

      // Check whether this account has a verified MFA factor enrolled.
      // If so, the session is currently AAL1 — we must step up to AAL2.
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
        // Build the post-MFA destination so the verify page can land there.
        const postMfa = buildPostLoginDestination(nextPath, null);
        router.push(`/mfa/verify?next=${encodeURIComponent(postMfa)}`);
        router.refresh();
        return;
      }

      // No MFA required — resolve the post-login destination.
      const destination = await resolveDestination(nextPath);
      router.push(destination);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-email">
          Email address
        </label>
        <input
          id="login-email"
          className={styles.input}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

/** Resolve where to send the user after a successful password auth (no MFA needed). */
async function resolveDestination(nextPath: string): Promise<string> {
  // Honour the ?next= param set by middleware — but never redirect back to auth pages.
  if (nextPath && nextPath !== "/login" && nextPath !== "/signup" && !nextPath.startsWith("/mfa")) {
    return nextPath;
  }
  return buildPostLoginDestination(nextPath, await fetchTenants());
}

function buildPostLoginDestination(
  nextPath: string,
  tenants: { id: string; role: string }[] | null
): string {
  if (nextPath && nextPath !== "/login" && nextPath !== "/signup" && !nextPath.startsWith("/mfa")) {
    return nextPath;
  }
  if (!tenants || tenants.length === 0) return "/onboarding";
  return `/analyst?tenantId=${encodeURIComponent(pickBestTenantId(tenants))}`;
}

async function fetchTenants(): Promise<{ id: string; role: string }[]> {
  try {
    const res = await fetch("/api/me");
    const me = (await res.json()) as MeResponse;
    return me.ok ? (me.tenants ?? []) : [];
  } catch {
    return [];
  }
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <p className={styles.brandEyebrow}>Secure Operations Platform</p>
        <h1 className={styles.brandName}>SecureWatch360</h1>
        <p className={styles.brandTagline}>
          One platform. Total protection. Continuous compliance.
        </p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Sign in</h2>
        <p className={styles.cardSubtitle}>
          Enter your credentials to access the console.
        </p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <hr className={styles.divider} />
        <p className={styles.footer}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className={styles.footerLink}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
