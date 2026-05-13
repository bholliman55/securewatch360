"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setSuccess("Signed in. Redirecting...");
      const next = new URLSearchParams(window.location.search).get("next") ?? "/console";
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #071526 0%, #0d1e33 50%, #071526 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(41,182,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(41,182,246,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "rgba(13,30,51,0.95)",
            border: "1px solid rgba(41,182,246,0.25)",
            borderRadius: 16,
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(41,182,246,0.08)",
            padding: "2.5rem 2rem",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Brand header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <Image
              src="/images/securewatch360-logo.png"
              alt="SecureWatch360"
              width={64}
              height={64}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(41,182,246,0.3)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                marginBottom: "1rem",
              }}
              priority
            />
            <div
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: "1.6rem",
                letterSpacing: "0.04em",
                color: "#29b6f6",
                lineHeight: 1,
              }}
            >
              SecureWatch<span style={{ color: "#00e5ff" }}>360</span>
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#8ab4d4",
                marginTop: "0.35rem",
              }}
            >
              One Platform. Total Protection. Continuous Compliance.
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(41,182,246,0.3), transparent)",
              marginBottom: "1.75rem",
            }}
          />

          <h1
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "#e2e8f0",
              margin: "0 0 1.25rem",
            }}
          >
            Sign in to your account
          </h1>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#8ab4d4", letterSpacing: "0.04em" }}>
                Email address
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(41,182,246,0.2)",
                  borderRadius: 8,
                  padding: "0.65rem 0.875rem",
                  color: "#e2e8f0",
                  fontSize: "0.9rem",
                  outline: "none",
                  transition: "border-color 0.15s",
                  width: "100%",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(41,182,246,0.6)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(41,182,246,0.2)"; }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#8ab4d4", letterSpacing: "0.04em" }}>
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(41,182,246,0.2)",
                  borderRadius: 8,
                  padding: "0.65rem 0.875rem",
                  color: "#e2e8f0",
                  fontSize: "0.9rem",
                  outline: "none",
                  transition: "border-color 0.15s",
                  width: "100%",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(41,182,246,0.6)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(41,182,246,0.2)"; }}
              />
            </label>

            {error && (
              <p
                style={{
                  margin: 0,
                  padding: "0.65rem 0.875rem",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8,
                  color: "#f87171",
                  fontSize: "0.83rem",
                }}
              >
                {error}
              </p>
            )}

            {success && (
              <p
                style={{
                  margin: 0,
                  padding: "0.65rem 0.875rem",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 8,
                  color: "#4ade80",
                  fontSize: "0.83rem",
                }}
              >
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.25rem",
                padding: "0.75rem 1rem",
                background: loading
                  ? "rgba(21,101,192,0.5)"
                  : "linear-gradient(135deg, #1565c0, #1e88e5)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.03em",
                boxShadow: loading ? "none" : "0 4px 16px rgba(21,101,192,0.4)",
                transition: "opacity 0.15s, box-shadow 0.15s",
              }}
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <p
            style={{
              marginTop: "1.5rem",
              textAlign: "center",
              fontSize: "0.78rem",
              color: "#4a6fa5",
            }}
          >
            Need an account?{" "}
            <Link
              href="/signup"
              style={{ color: "#29b6f6", textDecoration: "none", fontWeight: 500 }}
            >
              Sign up
            </Link>
          </p>
        </div>

        <p
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            fontSize: "0.7rem",
            color: "#2a4a6a",
            letterSpacing: "0.06em",
          }}
        >
          SECURE · COMPLIANT · CONTINUOUS
        </p>
      </div>
    </div>
  );
}
