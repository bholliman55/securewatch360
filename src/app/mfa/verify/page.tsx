"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "../mfa.module.css";

type Factor = { id: string; friendly_name?: string };

function MfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/analyst";

  const [factor, setFactor] = useState<Factor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load enrolled TOTP factors on mount.
  useEffect(() => {
    let cancelled = false;
    async function loadFactors() {
      const supabase = getSupabaseBrowserClient();
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listErr) {
        setLoadError(listErr.message);
        return;
      }
      const totp = data?.totp ?? [];
      const verified = totp.filter((f) => f.status === "verified");
      if (verified.length === 0) {
        // No enrolled factor — skip MFA and go straight to destination.
        router.replace(nextPath);
        return;
      }
      setFactor(verified[0]);
    }
    void loadFactors();
    return () => { cancelled = true; };
  }, [nextPath, router]);

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!factor) return;
    const digits = code.replace(/\s/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const { data: challenge, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr || !challenge) {
        setError(challengeErr?.message ?? "Challenge failed. Try again.");
        return;
      }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: digits,
      });
      if (verifyErr) {
        setError("Incorrect code. Check your authenticator app and try again.");
        setCode("");
        return;
      }

      // AAL2 achieved — send user to their destination.
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loadError) return <p className={styles.error}>{loadError}</p>;
  if (!factor) return <p className={styles.cardSubtitle}>Loading…</p>;

  return (
    <form onSubmit={onVerify}>
      <div className={styles.codeField}>
        <label className={styles.codeLabel} htmlFor="mfa-verify-code">
          6-digit code from your authenticator app
        </label>
        <input
          id="mfa-verify-code"
          className={styles.codeInput}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000 000"
          maxLength={7}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9\s]/g, ""))}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}

export default function MfaVerifyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <p className={styles.brandEyebrow}>Two-factor authentication</p>
        <h1 className={styles.brandName}>SecureWatch360</h1>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Enter your MFA code</h2>
        <p className={styles.cardSubtitle}>
          Open your authenticator app and enter the current 6-digit code for
          SecureWatch360.
        </p>

        <Suspense fallback={<p className={styles.cardSubtitle}>Loading…</p>}>
          <MfaVerifyForm />
        </Suspense>

        <hr className={styles.divider} />
        <p className={styles.footer}>
          Lost access to your authenticator?{" "}
          <a href="mailto:support@securewatch360.com" className={styles.footerLink}>
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
