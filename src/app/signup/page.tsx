"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSuccess("Signup submitted. Check your email if confirmation is enabled.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Sign Up</h1>
      <p>Starter auth page for SecureWatch360 v1.</p>

      <form onSubmit={onSubmit} className="sw-form">
        <label className="sw-field">
          Email
          <input
            className="sw-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="sw-field">
          Password
          <input
            className="sw-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        <button className="sw-button" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {success ? <p className="sw-success">{success}</p> : null}
      {error ? <p className="sw-error">{error}</p> : null}

      <p>
        Already have an account? <Link href="/login">Login</Link>
      </p>
    </main>
  );
}
