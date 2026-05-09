"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { PASSWORD_RULES, validatePassword } from "@/lib/passwordPolicy";
import styles from "../login/auth.module.css";
import pwdStyles from "./signup.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ruleResults = PASSWORD_RULES.map((r) => ({
    ...r,
    passed: r.test(password),
  }));
  const allRulesPassed = ruleResults.every((r) => r.passed);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const pwdError = validatePassword(password);
    if (pwdError) { setError(pwdError); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        // Auto-confirmed — go to MFA setup, then onboarding.
        router.push("/mfa/setup?next=/onboarding");
        router.refresh();
        return;
      }

      setSuccess(
        "Account created! Check your email for a confirmation link, then sign in."
      );
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
        <h2 className={styles.cardTitle}>Create account</h2>
        <p className={styles.cardSubtitle}>
          Get started with SecureWatch360 in minutes.
        </p>

        {success ? (
          <>
            <p className={styles.success}>{success}</p>
            <hr className={styles.divider} />
            <p className={styles.footer}>
              <Link href="/login" className={styles.footerLink}>
                Go to sign in →
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="signup-email">
                Email address
              </label>
              <input
                id="signup-email"
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
              <label className={styles.label} htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="Min. 16 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {/* Password strength checklist */}
              {password.length > 0 && (
                <ul className={pwdStyles.ruleList}>
                  {ruleResults.map((r) => (
                    <li
                      key={r.id}
                      className={`${pwdStyles.rule} ${r.passed ? pwdStyles.pass : pwdStyles.fail}`}
                    >
                      <span className={pwdStyles.ruleIcon}>{r.passed ? "✓" : "✗"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="signup-confirm">
                Confirm password
              </label>
              <input
                id="signup-confirm"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !allRulesPassed}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {!success && (
          <>
            <hr className={styles.divider} />
            <p className={styles.footer}>
              Already have an account?{" "}
              <Link href="/login" className={styles.footerLink}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
