"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "../mfa.module.css";

type EnrollData = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function MfaSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/onboarding";

  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Kick off TOTP enrollment on mount.
  useEffect(() => {
    let cancelled = false;
    async function startEnroll() {
      const supabase = getSupabaseBrowserClient();

      // Clean up any existing unverified TOTP factors first so enrollment succeeds
      const { data: listData } = await supabase.auth.mfa.listFactors();
      const unverified = listData?.totp?.filter((f) => f.status === "unverified") ?? [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setLoadError(
          "MFA setup is not available right now. You can skip this and enable it later from your account settings."
        );
        return;
      }
      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }
    void startEnroll();
    return () => { cancelled = true; };
  }, []);

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enroll) return;
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
        await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (challengeErr || !challenge) {
        setError(challengeErr?.message ?? "Challenge failed.");
        return;
      }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.id,
        code: digits,
      });
      if (verifyErr) {
        setError("Incorrect code. Check your authenticator app and try again.");
        return;
      }

      // Enrollment verified — proceed to next destination.
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {loadError && (
        <>
          <p className={styles.error}>{loadError}</p>
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button
              className={styles.skipBtn}
              onClick={() => router.push(nextPath)}
            >
              Skip for now →
            </button>
          </div>
        </>
      )}

      {!enroll && !loadError && (
        <div className={styles.qrWrap}>
          <div className={styles.qrLoading}>Loading…</div>
        </div>
      )}

      {enroll && (
        <>
          <div className={styles.qrWrap}>
            <div className={styles.qrBox}>
              {/* qr_code is a data: URI — render as <img> */}
              <img src={enroll.qrCode} alt="Scan this QR code in your authenticator app" />
            </div>
          </div>

          <div className={styles.secretBlock}>
            <p className={styles.secretLabel}>Manual entry key</p>
            <p className={styles.secretValue}>{enroll.secret}</p>
          </div>

          <ul className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNum}>1</span>
              Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>2</span>
              Scan the QR code or enter the key above manually.
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>3</span>
              Enter the 6-digit code the app shows below.
            </li>
          </ul>

          <form onSubmit={onVerify}>
            <div className={styles.codeField}>
              <label className={styles.codeLabel} htmlFor="mfa-setup-code">
                6-digit verification code
              </label>
              <input
                id="mfa-setup-code"
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000 000"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9\s]/g, ""))}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading || !enroll}>
              {loading ? "Verifying…" : "Confirm & enable MFA"}
            </button>
          </form>

          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button
              className={styles.skipBtn}
              onClick={() => router.push(nextPath)}
            >
              Skip for now →
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default function MfaSetupPage() {
  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <p className={styles.brandEyebrow}>Security</p>
        <h1 className={styles.brandName}>SecureWatch360</h1>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Set up two-factor authentication</h2>
        <p className={styles.cardSubtitle}>
          MFA adds a second layer of protection to your account. You will need your
          authenticator app every time you sign in.
        </p>

        <Suspense fallback={<div className={styles.qrLoading}>Loading…</div>}>
          <MfaSetupForm />
        </Suspense>
      </div>
    </div>
  );
}
